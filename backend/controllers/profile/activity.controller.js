import mongoose from "mongoose";
import Post from "../../models/post.model.js";
import Shorts from "../../models/shorts.model.js";
import { istDateKey, istDayStart } from "../../utils/eventTime.js";

export const ACTIVITY_DAYS = 112; // 16 weeks

/**
 * The last `days` IST calendar days ending on `endKey`, oldest first, each
 * with its count from `counts` (a { "YYYY-MM-DD": n } map) or 0. IST has no
 * DST, so stepping the day start by 24h always lands on the next day.
 */
export const buildActivitySeries = (counts, endKey = istDateKey(), days = ACTIVITY_DAYS) => {
  const end = istDayStart(endKey).getTime();
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = istDateKey(new Date(end - i * 86400000));
    out.push({ date, count: counts[date] || 0 });
  }
  return out;
};

// Aggregate does not cast, so `user` must already be an ObjectId.
const dailyCounts = (Model, match) =>
  Model.aggregate([
    { $match: match },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" } }, n: { $sum: 1 } } },
  ]);

// GET /profile/activity/:userId → { success, days: [{ date, count }] }
export const getActivity = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }
    const endKey = istDateKey();
    const user = new mongoose.Types.ObjectId(userId);
    const createdAt = { $gte: new Date(istDayStart(endKey).getTime() - (ACTIVITY_DAYS - 1) * 86400000) };

    // Same rule as getPostsByUserId: private posts count only for their owner.
    const postMatch = { user, createdAt };
    if (req.user.id !== userId) postMatch.isPrivate = { $ne: true };

    const [posts, shorts] = await Promise.all([
      dailyCounts(Post, postMatch),
      dailyCounts(Shorts, { user, createdAt }),
    ]);
    const counts = {};
    for (const row of [...posts, ...shorts]) counts[row._id] = (counts[row._id] || 0) + row.n;

    return res.status(200).json({
      success: true,
      days: buildActivitySeries(counts, endKey),
    });
  } catch (error) {
    console.log("Error fetching activity:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
