import mongoose from "mongoose";

/**
 * One row per (student, note) the first time they open it.
 *
 * Downloads are free, so this is not a receipt — it is what builds a student's
 * library and keeps the download counter honest, since reopening a file should
 * not inflate it or pay the uploader twice.
 */
const noteDownloadSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    note: { type: mongoose.Schema.Types.ObjectId, ref: "Note", required: true },
  },
  { timestamps: true },
);

// The uniqueness constraint is the feature: it is what distinguishes a first
// open from a repeat.
noteDownloadSchema.index({ user: 1, note: 1 }, { unique: true });
// "What have I unlocked" — the student's library.
noteDownloadSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("NoteDownload", noteDownloadSchema);
