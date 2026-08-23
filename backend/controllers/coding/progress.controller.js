/**
 * A student's Arena progress, for the app.
 *
 * Solving happens on the web, where there is a keyboard and a real editor.
 * The app's job is to show where you stand and what is coming — so this is a
 * read-only summary, deliberately not another way to submit code.
 */
import mongoose from "mongoose";
import CodingSubmission from "../../models/coding/codingSubmission.model.js";
import Problem from "../../models/coding/problem.model.js";
import Contest from "../../models/coding/contest.model.js";
import User from "../../models/user.model.js";

export const getArenaProgress = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const [solvedRows, attemptedIds, recent, user, contests] = await Promise.all([
      // Distinct problems actually solved, joined to difficulty so the split is
      // computed in the database rather than by pulling every submission.
      CodingSubmission.aggregate([
        { $match: { user: userId, status: "Accepted" } },
        { $group: { _id: "$problem" } },
        { $lookup: { from: "problems", localField: "_id", foreignField: "_id", as: "p" } },
        { $unwind: "$p" },
        { $group: { _id: "$p.difficulty", n: { $sum: 1 } } },
      ]),

      CodingSubmission.distinct("problem", { user: userId }),

      CodingSubmission.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("problem", "title difficulty points")
        .select("status passedCount totalCount language createdAt problem")
        .lean(),

      User.findById(userId).select("streakCount highestStreak codingStats coins").lean(),

      // Full history with the student's own result, plus where they placed.
      // A contest list without your score is just a calendar.
      Contest.find({ "participants.user": userId })
        .sort({ startTime: -1 })
        .limit(20)
        .select("title startTime endTime status participants")
        .lean(),
    ]);

    const byDifficulty = { Easy: 0, Medium: 0, Hard: 0 };
    solvedRows.forEach((r) => {
      if (r._id in byDifficulty) byDifficulty[r._id] = r.n;
    });

    const solved = Object.values(byDifficulty).reduce((a, b) => a + b, 0);
    const totals = await Problem.countDocuments({});

    // Rank is computed from the participant list already loaded rather than a
    // second query per contest.
    const contestHistory = contests.map((c) => {
      const sorted = [...(c.participants ?? [])].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      const idx = sorted.findIndex((p) => String(p.user) === String(userId));
      const mine = idx >= 0 ? sorted[idx] : null;
      return {
        _id: c._id,
        title: c.title,
        startTime: c.startTime,
        status: c.status,
        score: mine?.score ?? 0,
        rank: idx >= 0 ? idx + 1 : null,
        outOf: sorted.length,
        // Entered but never scored is a different outcome from placing last,
        // and a student deserves to see which one happened.
        attempted: !!mine?.enteredAt,
      };
    });

    /**
     * The solving streak, counted from submission dates.
     *
     * Deliberately separate from the app-wide posting streak: this one only
     * moves when a student actually solves something, so it means what it says.
     */
    const days = await CodingSubmission.aggregate([
      { $match: { user: userId, status: "Accepted" } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" } } } },
      { $sort: { _id: -1 } },
      { $limit: 400 },
    ]);

    const dayKeys = days.map((d) => d._id);
    const daySet = new Set(dayKeys);
    const IST = (d) => new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

    let solveStreak = 0;
    const cursor = new Date();
    // Today not counting yet is not a broken streak — it is a day in progress,
    // so the count starts from yesterday if nothing has been solved today.
    if (!daySet.has(IST(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
    while (daySet.has(IST(cursor))) {
      solveStreak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }

    const solvedToday = daySet.has(IST(new Date()));

    return res.status(200).json({
      success: true,
      progress: {
        solved,
        attempted: attemptedIds.length,
        // Attempted-but-unsolved is the number worth showing next to solved:
        // it is the pile a student can actually go and finish.
        unsolved: Math.max(0, attemptedIds.length - solved),
        totalProblems: totals,
        byDifficulty,
        streak: user?.streakCount ?? 0,
        longestStreak: user?.highestStreak ?? 0,
        solveStreak,
        solvedToday,
        activeDays: dayKeys.length,
        // Last 30 IST days as booleans, oldest first — the grid the app draws.
        last30: Array.from({ length: 30 }, (_, i) => {
          const d = new Date();
          d.setUTCDate(d.getUTCDate() - (29 - i));
          return daySet.has(IST(d));
        }),
        coins: user?.coins ?? 0,
        externalSolved: user?.codingStats?.totalSolved ?? 0,
        recent,
        contests: contestHistory,
      },
    });
  } catch (error) {
    console.error("Arena progress failed:", error.message);
    return res.status(500).json({ success: false, message: "Could not load your progress." });
  }
};


/**
 * Arena leaderboard, ranked on problems actually solved here.
 *
 * Deliberately not the external-profile leaderboard: that one ranks LeetCode
 * and GFG totals, which say nothing about the contests a student turned up to.
 * Points come from the problems themselves, so a Hard solve outweighs three
 * Easy ones rather than every solve counting the same.
 *
 * Scoped to the caller's college by default, because a rank among four thousand
 * strangers motivates nobody — being seventh in your own batch does.
 */
export const getArenaLeaderboard = async (req, res) => {
  try {
    const me = await User.findById(req.user.id).select("college").lean();
    const scope = req.query.scope === "global" ? "global" : "college";

    const collegeFilter =
      scope === "college" && me?.college ? { "u.college": me.college } : {};

    const rows = await CodingSubmission.aggregate([
      { $match: { status: "Accepted" } },
      // One row per (student, problem): re-solving the same problem must not
      // farm points.
      { $group: { _id: { user: "$user", problem: "$problem" } } },
      { $lookup: { from: "problems", localField: "_id.problem", foreignField: "_id", as: "p" } },
      { $unwind: "$p" },
      {
        $group: {
          _id: "$_id.user",
          solved: { $sum: 1 },
          points: { $sum: { $ifNull: ["$p.points", 100] } },
        },
      },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "u" } },
      { $unwind: "$u" },
      { $match: { "u.isBanned": { $ne: true }, ...collegeFilter } },
      { $sort: { points: -1, solved: -1, _id: 1 } },
      { $limit: 50 },
      {
        $project: {
          _id: 1,
          solved: 1,
          points: 1,
          name: "$u.name",
          username: "$u.username",
          avatar: "$u.avatar",
          college: "$u.college",
        },
      },
    ]);

    const ranked = rows.map((r, i) => ({ ...r, rank: i + 1 }));
    const mine = ranked.find((r) => String(r._id) === String(req.user.id)) ?? null;

    return res.status(200).json({
      success: true,
      scope,
      college: me?.college ?? null,
      leaderboard: ranked,
      // Sent separately so the app can pin the caller's row even when they are
      // outside the top fifty — the number you most want to see is your own.
      me: mine,
    });
  } catch (error) {
    console.error("Arena leaderboard failed:", error.message);
    return res.status(500).json({ success: false, message: "Could not load the leaderboard." });
  }
};
