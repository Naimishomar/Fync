import cron from "node-cron";
import Note from "../models/note.model.js";
import { deleteFromR2 } from "./r2.js";

/**
 * Files older than a week are purged from R2 so storage stays flat.
 *
 * The database row is kept and flagged instead of deleted. Students spend coins
 * to unlock these, and NoteDownload rows are the receipt for that — removing
 * the note would leave those receipts pointing at nothing, and a library full
 * of entries that fail to open with no reason given.
 */
const RETENTION_DAYS = 7;

export const purgeExpiredNotes = async () => {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const stale = await Note.find({ expired: false, createdAt: { $lt: cutoff } })
    .select("fileUrl")
    .lean();

  if (!stale.length) return 0;

  // Settled, not awaited in series: one unreachable object must not stop the
  // rest of the night's cleanup.
  const results = await Promise.allSettled(
    stale.map((n) => deleteFromR2(n.fileUrl)),
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed) console.error(`Note purge: ${failed}/${stale.length} R2 deletes failed`);

  // Flagged regardless of whether R2 confirmed. A file we could not delete is
  // still one we will not serve, and leaving the flag off would retry it every
  // night forever.
  await Note.updateMany(
    { _id: { $in: stale.map((n) => n._id) } },
    { $set: { expired: true, expiredAt: new Date(), fileUrl: "" } },
  );

  console.log(`🧹 Notes purge: ${stale.length} files older than ${RETENTION_DAYS} days removed`);
  return stale.length;
};

export const initNoteCleanup = () => {
  // 3am: after the midnight cleanups, so they are not all competing for the
  // same R2 connection budget at once.
  cron.schedule("0 3 * * *", () => {
    purgeExpiredNotes().catch((err) => console.error("Note cleanup error:", err.message));
  });
};

export default initNoteCleanup;
