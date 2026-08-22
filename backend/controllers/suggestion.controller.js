/**
 * "People you might know", for injection into the post feed.
 *
 * Ranked by mutual connections first, then by sharing a college. A student who
 * follows nobody yet has no mutuals, so college is what stops the list being
 * empty on day one — which is exactly when suggestions matter most.
 */
import mongoose from "mongoose";
import User from "../models/user.model.js";

const MAX_LIMIT = 12;

export const getFollowSuggestions = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit ?? "6", 10) || 6, MAX_LIMIT);
    const me = new mongoose.Types.ObjectId(req.user.id);

    const user = await User.findById(me).select("following college").lean();
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const following = (user.following ?? []).map((f) => new mongoose.Types.ObjectId(String(f)));
    // Never suggest the user themselves or anyone they already follow.
    const exclude = [...following, me];

    const suggestions = await User.aggregate([
      {
        $match: {
          _id: { $nin: exclude },
          user_access: { $in: ["user", "alumni"] },
          // A suggestion the student cannot act on is noise.
          isBanned: { $ne: true },
        },
      },
      {
        $addFields: {
          // How many of the people I follow also follow this person. Computed
          // with a set intersection rather than a lookup, so it stays a single
          // pass over the collection.
          mutuals: {
            $size: { $setIntersection: [{ $ifNull: ["$followers", []] }, following] },
          },
          sameCollege: { $cond: [{ $eq: ["$college", user.college] }, 1, 0] },
          followerCount: { $size: { $ifNull: ["$followers", []] } },
        },
      },
      // Someone with no mutuals and a different college is a stranger from
      // another campus — that is not a suggestion, it is a random row.
      { $match: { $or: [{ mutuals: { $gt: 0 } }, { sameCollege: 1 }] } },
      { $sort: { mutuals: -1, sameCollege: -1, followerCount: -1, _id: 1 } },
      { $limit: limit },
      {
        $project: {
          name: 1, username: 1, avatar: 1, college: 1, major: 1,
          mutuals: 1, sameCollege: 1,
        },
      },
    ]);

    return res.status(200).json({ success: true, suggestions });
  } catch (error) {
    console.error("Follow suggestions failed:", error.message);
    // An empty list degrades the feed gracefully; an error would break it.
    return res.status(200).json({ success: true, suggestions: [] });
  }
};
