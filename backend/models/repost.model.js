import mongoose from "mongoose";

/**
 * One row per repost.
 *
 * The post itself keeps `repostedBy` and `reposts` — those answer "did I
 * repost this" and "how many" in the same read as the post, which is what the
 * feed row needs. This collection answers the questions an array on the post
 * cannot: when it was reposted, and what the reposter said about it.
 */
const repostSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: "postType",
  },
  postType: {
    type: String,
    required: true,
    enum: ["Post", "Shorts"],
  },
  /** What the reposter added. Empty when they shared it without comment. */
  text: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: "",
  },
}, { timestamps: true });

// The profile tab and the following feed both read "newest first, by user".
repostSchema.index({ user: 1, createdAt: -1 });
// One repost per person per item — the same guarantee `$addToSet` gives the
// array on the post, enforced here so the two cannot disagree.
repostSchema.index({ post: 1, user: 1 }, { unique: true });

export default mongoose.model("Repost", repostSchema);
