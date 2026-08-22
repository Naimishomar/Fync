import mongoose from "mongoose";

/**
 * A study resource shared inside a college: notes, a past paper, or a lab file.
 *
 * Scoped to a college on purpose. A first-year at one campus has no use for
 * another campus's syllabus, and keeping the pool local is what makes the
 * listing feel curated rather than a dumping ground.
 */
const noteSchema = new mongoose.Schema(
  {
    uploader: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Denormalised from the uploader so listings do not need a join to filter,
    // and so a note survives its uploader changing college.
    college: { type: String, required: true },

    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, trim: true, maxlength: 600, default: "" },

    subject: { type: String, required: true, trim: true, maxlength: 80 },
    semester: { type: Number, min: 1, max: 8 },
    branch: { type: String, trim: true, maxlength: 60 },
    kind: { type: String, enum: ["notes", "pyq", "lab", "syllabus"], default: "notes" },

    fileUrl: { type: String, required: true },
    /**
     * SHA-256 of the file's bytes, so the same paper is recognised however it
     * was named. Filenames are useless for this — the same scan arrives as
     * "unit3.pdf", "unit3final.pdf" and "IMG_0042.pdf".
     */
    fileHash: { type: String, index: true },
    fileSize: { type: Number, default: 0 },
    pages: { type: Number, default: 0 },

    downloads: { type: Number, default: 0 },
    upvotes: { type: Number, default: 0 },
    upvotedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Reports are counted rather than acted on automatically; hiding on a
    // threshold would let a handful of students bury a rival's notes.
    /**
     * Files are purged from R2 after a week to keep storage flat, but the row
     * stays. Students pay coins to unlock these, and a hard delete would turn
     * their library into a list of links that error with no explanation — this
     * way the entry survives and can say what happened.
     */
    expired: { type: Boolean, default: false },
    expiredAt: { type: Date, default: null },

    reports: { type: Number, default: 0 },
    reportedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    hidden: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// The listing query: college + filters, newest first. Covers the common case of
// browsing a subject within a semester.
noteSchema.index({ college: 1, hidden: 1, semester: 1, subject: 1, createdAt: -1 });
// "Most downloaded in my college", the default sort on the browse screen.
noteSchema.index({ college: 1, hidden: 1, downloads: -1 });
// A student's own uploads.
noteSchema.index({ uploader: 1, createdAt: -1 });
// The nightly purge: find live files older than the retention window.
noteSchema.index({ expired: 1, createdAt: 1 });
// Duplicate detection, scoped to a college. Partial so that expired notes —
// whose files are gone — do not block the same material being shared again.
noteSchema.index(
  { college: 1, fileHash: 1 },
  { unique: true, partialFilterExpression: { fileHash: { $type: "string" }, expired: false } },
);
// Text search over the fields a student would actually type.
noteSchema.index({ title: "text", subject: "text", description: "text" });

export default mongoose.model("Note", noteSchema);
