/**
 * Tagging people in posts, with their consent.
 *
 * A tag is a claim on somebody else's profile: once accepted, the post shows up
 * on their page as if they had a hand in it. That makes it the one social action
 * here that cannot be one-sided — so a tag starts as a request and only becomes
 * visible on their profile when they say yes.
 */
import mongoose from "mongoose";
import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";

const MAX_TAGS = 10;

/** Tag people on a post you own. */
export const tagUsers = async (req, res) => {
  try {
    const { id } = req.params;
    const { userIds } = req.body || {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Unknown post." });
    }
    if (!Array.isArray(userIds) || !userIds.length) {
      return res.status(400).json({ success: false, message: "Pick at least one person to tag." });
    }

    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ success: false, message: "Post not found." });
    if (String(post.user) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: "Only the author can tag people." });
    }

    const existing = new Set((post.tags ?? []).map((t) => String(t.user)));
    // Tagging yourself is meaningless — the post is already on your profile.
    const fresh = [...new Set(userIds.map(String))]
      .filter((u) => mongoose.isValidObjectId(u) && !existing.has(u) && u !== String(req.user.id));

    if (!fresh.length) {
      return res.status(200).json({ success: true, added: 0, message: "Those people are already tagged." });
    }
    if (existing.size + fresh.length > MAX_TAGS) {
      return res.status(400).json({ success: false, message: `A post can tag at most ${MAX_TAGS} people.` });
    }

    post.tags.push(...fresh.map((u) => ({ user: u, status: "pending" })));
    await post.save();

    const author = await User.findById(req.user.id).select("name username").lean();
    // Best effort: the tag is recorded either way, and a failed notification
    // should not undo it.
    Promise.allSettled(
      fresh.map((u) =>
        Notification.create({
          recipient: u,
          sender: req.user.id,
          type: "post",
          message: `${author?.name ?? author?.username ?? "Someone"} tagged you in a post. Accept it to show it on your profile.`,
        }),
      ),
    ).catch(() => {});

    return res.status(200).json({ success: true, added: fresh.length });
  } catch (error) {
    console.error("Tag users failed:", error.message);
    return res.status(500).json({ success: false, message: "Could not tag them." });
  }
};

/** Accept or decline a tag on yourself. */
export const respondToTag = async (req, res) => {
  try {
    const { id } = req.params;
    const { accept } = req.body || {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Unknown post." });
    }

    // Matched on the tag subdocument so somebody can only ever answer their own
    // tag, and only one that is still pending.
    const post = await Post.findOneAndUpdate(
      { _id: id, tags: { $elemMatch: { user: req.user.id, status: "pending" } } },
      {
        $set: {
          "tags.$.status": accept ? "accepted" : "declined",
          "tags.$.respondedAt": new Date(),
        },
      },
      { new: true },
    ).select("user tags");

    if (!post) {
      return res.status(404).json({ success: false, message: "No pending tag for you on that post." });
    }

    return res.status(200).json({ success: true, status: accept ? "accepted" : "declined" });
  } catch (error) {
    console.error("Respond to tag failed:", error.message);
    return res.status(500).json({ success: false, message: "Could not save that." });
  }
};

/** Tags waiting on the caller. */
export const getPendingTags = async (req, res) => {
  try {
    const posts = await Post.find({
      tags: { $elemMatch: { user: req.user.id, status: "pending" } },
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .populate("user", "name username avatar")
      .select("description image createdAt user")
      .lean();

    return res.status(200).json({ success: true, posts });
  } catch (error) {
    console.error("Pending tags failed:", error.message);
    return res.status(500).json({ success: false, message: "Could not load your tags." });
  }
};

/**
 * Posts that appear on someone's profile because they accepted a tag.
 *
 * Only accepted ones. Pending and declined tags are private to the person who
 * was tagged — a pending tag showing publicly would defeat the point of asking.
 */
export const getTaggedPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: "Unknown user." });
    }

    const posts = await Post.find({
      tags: { $elemMatch: { user: userId, status: "accepted" } },
      isPrivate: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("user", "name username avatar")
      .lean();

    return res.status(200).json({ success: true, posts });
  } catch (error) {
    console.error("Tagged posts failed:", error.message);
    return res.status(500).json({ success: false, message: "Could not load those posts." });
  }
};
