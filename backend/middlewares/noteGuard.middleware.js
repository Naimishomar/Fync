/**
 * Screening that runs before a note reaches storage.
 *
 * Deliberately placed between multer and the R2 upload: both checks reject the
 * file while it is still only a buffer in memory, so a duplicate or an unsafe
 * PDF never costs storage and never leaves an orphaned object behind.
 */
import crypto from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Note from "../models/note.model.js";
import User from "../models/user.model.js";

// Gemini rejects very large inline payloads, and a scan that throws would block
// legitimate uploads. Past this size the text pass is the only check.
const MAX_INLINE_SCAN_BYTES = 15 * 1024 * 1024;

/**
 * An obvious-cases pass over the extracted text.
 *
 * This is not the real defence — it exists so the common case is caught in
 * milliseconds without an API call, and so uploads still get some screening if
 * the model is unreachable. Word boundaries matter: "analysis" contains a
 * substring that a naive check would flag, and false positives on study notes
 * are worse than useless here.
 */
const EXPLICIT_TERMS = [
  "porn", "pornhub", "xvideos", "xnxx", "onlyfans", "nsfw",
  "hentai", "camgirl", "escort service", "sex video", "nude pics",
];

const looksExplicit = (text) => {
  const hay = String(text || "").toLowerCase();
  return EXPLICIT_TERMS.some((term) => {
    const pattern = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    return pattern.test(hay);
  });
};

/** Text of the first pages, which is all the keyword pass needs. */
async function extractText(buffer) {
  try {
    // Imported lazily: pdf-parse runs a debug harness at require time if its
    // entry point is loaded in some environments, and this keeps that off the
    // boot path.
    const { default: pdfParse } = await import("pdf-parse");
    const parsed = await pdfParse(buffer, { max: 12 });
    return { text: parsed.text ?? "", pages: parsed.numpages ?? 0 };
  } catch (err) {
    // A PDF we cannot parse is not automatically a bad PDF — scanned notes are
    // images with no text layer at all, and those are exactly what the model
    // pass is for.
    console.error("Note text extraction failed:", err.message);
    return { text: "", pages: 0 };
  }
}

/**
 * Ask Gemini whether the document is study material.
 *
 * The PDF goes in as inline data rather than extracted text, because a scanned
 * or image-only document has no text to extract — which is precisely how
 * explicit content would arrive. Text-only screening would wave it through.
 */
async function screenWithModel(buffer) {
  if (!process.env.GEMINI_API_KEY) return { checked: false, explicit: false };
  if (buffer.length > MAX_INLINE_SCAN_BYTES) return { checked: false, explicit: false };

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "application/pdf",
          data: buffer.toString("base64"),
        },
      },
      {
        text:
          "You are screening a file uploaded to a student notes-sharing app. " +
          "Answer with exactly one word. Reply UNSAFE if the document contains " +
          "pornographic or sexually explicit images or text, nudity, or content " +
          "sexualising minors. Reply SAFE for anything else, including medical, " +
          "biological or anatomical material in an educational context. " +
          "If you are unsure, reply SAFE.",
      },
    ]);

    const verdict = (result.response.text() ?? "").trim().toUpperCase();
    return { checked: true, explicit: verdict.startsWith("UNSAFE") };
  } catch (err) {
    // The model being unavailable must not become an upload outage. The text
    // pass still ran, and reporting plus admin delete remain as the backstop.
    console.error("Note content screening failed:", err.message);
    return { checked: false, explicit: false };
  }
}

export const noteGuard = async (req, res, next) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ success: false, message: "A PDF is required." });
    }

    const buffer = req.file.buffer;

    // ── 1. Duplicate ────────────────────────────────────────────────────────
    // Content hash, not filename: the same paper gets re-uploaded as
    // "unit3.pdf", "unit3final.pdf" and "scan.pdf" by three different students.
    const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");

    const user = await User.findById(req.user.id).select("college").lean();
    if (!user?.college) {
      return res.status(400).json({ success: false, message: "Add your college before sharing notes." });
    }

    // Scoped to the college rather than global: the same paper being shared at
    // two different campuses is two useful listings, and the browse screen only
    // ever shows one college's pool anyway.
    const existing = await Note.findOne({ college: user.college, fileHash, expired: false })
      .select("title uploader")
      .populate("uploader", "name")
      .lean();

    if (existing) {
      return res.status(409).json({
        success: false,
        duplicate: true,
        message: `This file is already shared as "${existing.title}"${existing.uploader?.name ? ` by ${existing.uploader.name}` : ""}.`,
      });
    }

    // ── 2. Content ──────────────────────────────────────────────────────────
    const { text, pages } = await extractText(buffer);

    if (looksExplicit(text)) {
      return res.status(422).json({
        success: false,
        rejected: true,
        message: "This file does not look like study material and was not shared.",
      });
    }

    const screened = await screenWithModel(buffer);
    if (screened.explicit) {
      console.warn(`Note upload blocked by content screening: user ${req.user.id}`);
      return res.status(422).json({
        success: false,
        rejected: true,
        message: "This file does not look like study material and was not shared.",
      });
    }

    // Handed to the controller so it does not have to re-hash or re-parse.
    req.noteMeta = { fileHash, pages, screened: screened.checked };
    return next();
  } catch (error) {
    console.error("Note guard failed:", error.message);
    return res.status(500).json({ success: false, message: "Could not check this file." });
  }
};
