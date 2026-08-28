/**
 * Reposting, for posts and shorts.
 *
 * A repost is a reference, not a copy: the original is surfaced in the
 * reposter's feed with the author's credit intact. Copying would fork the
 * content, so an edit or a delete by the author would leave stale duplicates
 * scattered across other people's timelines.
 */
import mongoose from "mongoose";
import Post from "../models/post.model.js";
import Shorts from "../models/shorts.model.js";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";
import Repost from "../models/repost.model.js";

const MODELS = { post: Post, shorts: Shorts };
const POST_TYPES = { post: "Post", shorts: "Shorts" };

/**
 * Toggle a repost.
 *
 * Both directions are a single conditional update, so a double tap cannot
 * double-count and two devices cannot race the counter apart from the array.
 */
export const toggleRepost = (kind) => async (req, res) => {
  const Model = MODELS[kind];
  const { id } = req.params;
  // What the reposter added, LinkedIn style. Optional: sharing without a word
  // is the common case.
  const text = typeof req.body?.text === "string" ? req.body.text.trim().slice(0, 1000) : "";

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Unknown item." });
  }

  try {
    const doc = await Model.findById(id).select("user repostedBy").lean();
    if (!doc) return res.status(404).json({ success: false, message: "Not found." });

    // Reposting your own work just inflates your own numbers.
    if (String(doc.user) === String(req.user.id)) {
      return res.status(400).json({ success: false, message: "You cannot repost your own post." });
    }

    const already = (doc.repostedBy ?? []).some((u) => String(u) === String(req.user.id));

    const updated = already
      ? await Model.findOneAndUpdate(
          { _id: id, repostedBy: req.user.id },
          { $pull: { repostedBy: req.user.id }, $inc: { reposts: -1 } },
          { new: true, projection: { reposts: 1 } },
        )
      : await Model.findOneAndUpdate(
          { _id: id, repostedBy: { $ne: req.user.id } },
          { $addToSet: { repostedBy: req.user.id }, $inc: { reposts: 1 } },
          { new: true, projection: { reposts: 1 } },
        );

    // The filter not matching means someone else already applied this exact
    // change; the caller's intent is satisfied either way.
    if (!updated) {
      const current = await Model.findById(id).select("reposts").lean();
      return res.status(200).json({ success: true, reposted: !already, reposts: current?.reposts ?? 0 });
    }

    // The row carries the commentary and the time; the array on the post stays
    // the membership check. Both directions are idempotent, so a repeated tap
    // cannot leave one of them describing something the other does not.
    if (already) {
      await Repost.deleteOne({ post: id, user: req.user.id }).catch(() => {});
    } else {
      await Repost.updateOne(
        { post: id, user: req.user.id },
        { $set: { postType: POST_TYPES[kind], text }, $setOnInsert: { user: req.user.id, post: id } },
        { upsert: true },
      ).catch(() => {});
    }

    if (!already) {
      const actor = await User.findById(req.user.id).select("name username").lean();
      Notification.create({
        recipient: doc.user,
        sender: req.user.id,
        type: kind === "shorts" ? "short" : "post",
        message: `${actor?.name ?? actor?.username ?? "Someone"} reposted your ${kind === "shorts" ? "short" : "post"}.`,
      }).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      reposted: !already,
      // Clamped: a counter that drifted negative once would stay negative.
      reposts: Math.max(0, updated.reposts ?? 0),
    });
  } catch (error) {
    console.error(`Repost (${kind}) failed:`, error.message);
    return res.status(500).json({ success: false, message: "Could not repost that." });
  }
};

/** What a given student has reposted, for their profile. */
export const getReposts = (kind) => async (req, res) => {
  const Model = MODELS[kind];
  const { userId } = req.params;

  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ success: false, message: "Unknown user." });
  }

  try {
    // Sorted by when it was reposted, not when it was written: the tab is a
    // record of what this student shared, in the order they shared it.
    const rows = await Repost.find({ user: userId, postType: POST_TYPES[kind] })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate({
        path: "post",
        populate: { path: "user", select: "name username avatar user_access" },
      })
      .lean();

    const items = rows
      .filter((row) => row.post && row.post.isPrivate !== true)
      .map((row) => ({ ...row.post, repostText: row.text, repostedAt: row.createdAt }));

    return res.status(200).json({ success: true, [kind]: items });
  } catch (error) {
    console.error(`Get reposts (${kind}) failed:`, error.message);
    return res.status(500).json({ success: false, message: "Could not load those." });
  }
};
