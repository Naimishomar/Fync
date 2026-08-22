/**
 * Notes and past papers, shared freely between students.
 *
 * Downloading costs nothing. This is students helping each other through the
 * same exams, and a price on that turns a favour into a transaction — the
 * student who most needs the notes is the one least likely to have coins.
 *
 * Uploading still earns coins. The reward is what keeps material coming in, and
 * paying it from the platform rather than from the reader means supply is
 * encouraged without anyone being charged to study.
 */
import mongoose from "mongoose";
import Note from "../models/note.model.js";
import NoteDownload from "../models/noteDownload.model.js";
import User from "../models/user.model.js";
import { istDayStart } from "../utils/eventTime.js";

const UPLOAD_REWARD = 1;
const DOWNLOAD_REWARD = 1;      // to the uploader, each time someone opens it
const REWARDED_UPLOADS_PER_DAY = 3;
const MAX_LIMIT = 30;

/**
 * Share a file. The reward is capped per day because a flat per-upload payout
 * is otherwise just a coin printer for anyone willing to upload noise.
 */
export const uploadNote = async (req, res) => {
  try {
    if (!req.file?.path) {
      return res.status(400).json({ success: false, message: "A PDF is required." });
    }

    const user = await User.findById(req.user.id).select("college").lean();
    if (!user?.college) {
      return res.status(400).json({ success: false, message: "Add your college before sharing notes." });
    }

    const { title, subject } = req.body;
    if (!title?.trim() || !subject?.trim()) {
      return res.status(400).json({ success: false, message: "Title and subject are required." });
    }

    let note;
    try {
      note = await Note.create({
        uploader: req.user.id,
        college: user.college,
        title: title.trim(),
        description: (req.body.description ?? "").trim(),
        subject: subject.trim(),
        semester: req.body.semester ? Number(req.body.semester) : undefined,
        branch: (req.body.branch ?? "").trim() || undefined,
        kind: ["notes", "pyq", "lab", "syllabus"].includes(req.body.kind) ? req.body.kind : "notes",
        fileUrl: req.file.path,
        fileSize: req.file.size ?? 0,
        fileHash: req.noteMeta?.fileHash,
        pages: req.noteMeta?.pages ?? 0,
      });
    } catch (err) {
      // Two students uploading the same file at once both pass the middleware
      // check; the index is what actually decides.
      if (err?.code === 11000) {
        return res.status(409).json({
          success: false,
          duplicate: true,
          message: "Someone just shared this exact file.",
        });
      }
      throw err;
    }

    const rewardedToday = await Note.countDocuments({
      uploader: req.user.id,
      createdAt: { $gte: istDayStart() },
    });

    let earned = 0;
    if (rewardedToday <= REWARDED_UPLOADS_PER_DAY) {
      earned = UPLOAD_REWARD;
      await User.updateOne({ _id: req.user.id }, { $inc: { coins: earned } });
    }

    return res.status(201).json({ success: true, note, earned });
  } catch (error) {
    console.error("Note upload failed:", error.message);
    return res.status(500).json({ success: false, message: "Could not share this file." });
  }
};

/**
 * Browse the college's pool. The file URL is deliberately never included here —
 * it is the thing being paid for, and a listing that leaks it makes the price
 * optional.
 */
export const listNotes = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("college").lean();
    if (!user?.college) return res.status(200).json({ success: true, notes: [], hasMore: false });

    const limit = Math.min(parseInt(req.query.limit ?? "15", 10) || 15, MAX_LIMIT);
    const page = Math.max(parseInt(req.query.page ?? "1", 10) || 1, 1);

    const filter = { college: user.college, hidden: false, expired: false };
    if (req.query.subject) filter.subject = new RegExp(`^${escapeRegex(req.query.subject)}$`, "i");
    if (req.query.semester) filter.semester = Number(req.query.semester);
    if (req.query.branch) filter.branch = new RegExp(`^${escapeRegex(req.query.branch)}$`, "i");
    if (req.query.kind) filter.kind = req.query.kind;
    if (req.query.q) filter.$text = { $search: String(req.query.q) };

    const sort = req.query.sort === "popular" ? { downloads: -1 } : { createdAt: -1 };

    const notes = await Note.find(filter)
      .select("-fileUrl -upvotedBy -reportedBy")
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit + 1)
      .populate("uploader", "name username avatar")
      .lean();

    const hasMore = notes.length > limit;
    if (hasMore) notes.pop();

    // Which of these the student already owns, so the UI can show "Open"
    // instead of a price they have already paid.
    const owned = await NoteDownload.find({
      user: req.user.id,
      note: { $in: notes.map((n) => n._id) },
    }).select("note").lean();
    const ownedIds = new Set(owned.map((o) => String(o.note)));

    return res.status(200).json({
      success: true,
      notes: notes.map((n) => ({ ...n, owned: ownedIds.has(String(n._id)) })),
      hasMore,
    });
  } catch (error) {
    console.error("Note listing failed:", error.message);
    return res.status(500).json({ success: false, message: "Could not load notes." });
  }
};

/**
 * Open a file.
 *
 * Free, so there is no balance to check and no race to guard. The download
 * record is still written — once per student per note — because it is what
 * builds their library and keeps the counter honest when someone reopens a file
 * they have already read.
 */
export const unlockNote = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Unknown note." });
  }

  try {
    const note = await Note.findById(id)
      .select("fileUrl uploader hidden expired college title")
      .lean();
    if (!note || note.hidden) return res.status(404).json({ success: false, message: "Note not found." });

    if (note.expired || !note.fileUrl) {
      return res.status(410).json({
        success: false,
        message: "This file was removed after 7 days. Ask the uploader to share it again.",
        expired: true,
      });
    }

    const isOwn = String(note.uploader) === String(req.user.id);

    if (!isOwn) {
      // The unique index makes this once-per-student: a duplicate means they
      // have opened it before, so the counter and the uploader's reward are
      // skipped rather than paid twice.
      let first = false;
      try {
        await NoteDownload.create({ user: req.user.id, note: id });
        first = true;
      } catch (err) {
        if (err?.code !== 11000) throw err;
      }

      if (first) {
        // Best effort: the reader already has the file, and failing to record a
        // count must not take it away from them.
        Note.updateOne({ _id: id }, { $inc: { downloads: 1 } }).catch(() => {});
        User.updateOne({ _id: note.uploader }, { $inc: { coins: DOWNLOAD_REWARD } }).catch(() => {});
      }
    }

    return res.status(200).json({ success: true, fileUrl: note.fileUrl, charged: 0, owned: true });
  } catch (error) {
    console.error("Note open failed:", error.message);
    return res.status(500).json({ success: false, message: "Could not open this note." });
  }
};

/** Files this student has unlocked or uploaded — their library. */
export const myNotes = async (req, res) => {
  try {
    const [uploaded, unlocked] = await Promise.all([
      Note.find({ uploader: req.user.id })
        .select("-upvotedBy -reportedBy")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
      NoteDownload.find({ user: req.user.id })
        .sort({ createdAt: -1 })
        .limit(100)
        .populate({
          path: "note",
          select: "-upvotedBy -reportedBy",
          populate: { path: "uploader", select: "name username avatar" },
        })
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      uploaded,
      unlocked: unlocked.map((d) => d.note).filter(Boolean),
    });
  } catch (error) {
    console.error("My notes failed:", error.message);
    return res.status(500).json({ success: false, message: "Could not load your library." });
  }
};

export const upvoteNote = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Unknown note." });
  }
  try {
    // One vote per student, enforced by the update itself rather than by a
    // read-then-write that two taps could both pass.
    const added = await Note.findOneAndUpdate(
      { _id: id, upvotedBy: { $ne: req.user.id } },
      { $inc: { upvotes: 1 }, $addToSet: { upvotedBy: req.user.id } },
      { new: true, projection: { upvotes: 1 } },
    );
    if (added) return res.status(200).json({ success: true, upvotes: added.upvotes, voted: true });

    const removed = await Note.findOneAndUpdate(
      { _id: id, upvotedBy: req.user.id },
      { $inc: { upvotes: -1 }, $pull: { upvotedBy: req.user.id } },
      { new: true, projection: { upvotes: 1 } },
    );
    return res.status(200).json({ success: true, upvotes: removed?.upvotes ?? 0, voted: false });
  } catch (error) {
    console.error("Upvote failed:", error.message);
    return res.status(500).json({ success: false, message: "Could not register that." });
  }
};

export const reportNote = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Unknown note." });
  }
  try {
    await Note.updateOne(
      { _id: id, reportedBy: { $ne: req.user.id } },
      { $inc: { reports: 1 }, $addToSet: { reportedBy: req.user.id } },
    );
    return res.status(200).json({ success: true, message: "Reported. We will take a look." });
  } catch (error) {
    console.error("Report failed:", error.message);
    return res.status(500).json({ success: false, message: "Could not report this." });
  }
};

/** Remove your own upload, or anyone's if you are an admin. */
export const deleteNote = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Unknown note." });
  }
  try {
    const note = await Note.findById(id).select("uploader").lean();
    if (!note) return res.status(404).json({ success: false, message: "Note not found." });

    const isOwner = String(note.uploader) === String(req.user.id);
    const isAdmin = req.user.user_access === "admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: "Not yours to delete." });
    }

    await Note.deleteOne({ _id: id });
    // Unlock records are left in place on purpose: they are the receipt for
    // coins that were actually spent, and deleting them would erase that.
    return res.status(200).json({ success: true, message: "Removed." });
  } catch (error) {
    console.error("Note delete failed:", error.message);
    return res.status(500).json({ success: false, message: "Could not remove this." });
  }
};

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
