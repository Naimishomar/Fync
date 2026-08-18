import mongoose from "mongoose";
import redisClient from "../../utils/redis.js";
import Submission from "../../models/hackathon/submission.model.js";
import Score from "../../models/hackathon/score.model.js";
import Hackathon from "../../models/hackathon/hackathons.model.js";

// Average score per submission, straight from Mongo. Source of truth — Redis is
// only a cache of this, and it is empty on a cold/flushed/unreachable Redis.
const rankFromMongo = async (hackId) => {
  const rows = await Score.aggregate([
    { $match: { hackathon: new mongoose.Types.ObjectId(String(hackId)) } },
    { $group: { _id: "$submission", avg: { $avg: "$totalScore" } } },
    { $sort: { avg: -1 } },
  ]);
  return rows.map((r, i) => ({
    rank:         i + 1,
    submissionId: r._id.toString(),
    score:        parseFloat((r.avg || 0).toFixed(2)),
  }));
};

// GET /api/leaderboard/:hackathonId  — live ranked list from Redis
export const getLeaderboard = async (req, res, next) => {
  try {
    const hackId   = req.params.hackathonId;
    const boardKey = `hack:${hackId}:leaderboard`;

    // ZRANGE ... BYSCORE REV takes (max, min), NOT (min, max). Passing
    // ("-inf", "+inf") with REV asks for scores <= -inf, which is always the
    // empty set — the board rendered "Registry Dark" no matter how many judges
    // had scored.
    let ranked = [];
    try {
      const raw = await redisClient.zRangeWithScores(boardKey, "+inf", "-inf", { BY: 'SCORE', REV: true });
      ranked = (raw || []).map((entry, index) => ({
        rank:         index + 1,
        submissionId: entry.value,
        score:        parseFloat(parseFloat(entry.score).toFixed(2)),
      }));
    } catch (err) {
      console.error("Leaderboard Redis read failed, falling back to Mongo:", err.message);
    }

    // Redis down, cold, or flushed — rebuild the ranking from Score and warm
    // the cache so the next read is the fast path again.
    if (!ranked.length) {
      ranked = await rankFromMongo(hackId);
      if (ranked.length) {
        redisClient
          .zAdd(boardKey, ranked.map((r) => ({ score: r.score, value: r.submissionId })))
          .catch(() => {});
      }
    }

    if (!ranked.length)
      return res.status(200).json({ success: true, leaderboard: [], message: "No scores yet" });

    // Hydrate with project + team info from MongoDB
    const subIds = ranked.map((r) => r.submissionId);
    const subs   = await Submission.find({ _id: { $in: subIds } })
      .populate("team", "name")
      .select("ProjectName TagLine techStack team status")
      .lean();

    const subMap = {};
    subs.forEach((s) => { subMap[s._id.toString()] = s; });

    const enriched = ranked.map((r) => {
      const sub = subMap[r.submissionId] || {};
      return {
        rank:         r.rank,
        submissionId: r.submissionId,
        score:        r.score,
        projectName:  sub.ProjectName  || "—",
        tagline:      sub.TagLine      || "",
        techStack:    sub.techStack    || [],
        teamName:     sub.team?.name   || "—",
        status:       sub.status       || "—",
      };
    });

    res.status(200).json({ success: true, hackathonId: hackId, leaderboard: enriched });
  } catch (err) { next(err); }
};

// GET /api/leaderboard/:hackathonId/top/:n  — top N teams
export const getTopN = async (req, res, next) => {
  try {
    const { hackathonId } = req.params;
    // `:n` is user input. Unvalidated, `Number(n) - 1` becomes NaN and Redis
    // answers "ERR value is not an integer or out of range"; the Mongo fallback
    // then silently returns nothing, because slice(0, NaN) is empty.
    const n = Number.parseInt(req.params.n, 10);
    if (!Number.isFinite(n) || n < 1)
      return res.status(400).json({ success: false, message: "`n` must be a positive integer" });
    const top = Math.min(n, 100);

    const boardKey = `hack:${hackathonId}:leaderboard`;

    // ZREVRANGE with scores — top N
    let ranked = [];
    try {
      const raw = await redisClient.zRangeWithScores(boardKey, 0, top - 1, { REV: true });
      ranked = (raw || []).map((entry, index) => ({
        rank:         index + 1,
        submissionId: entry.value,
        score:        parseFloat(parseFloat(entry.score).toFixed(2)),
      }));
    } catch (err) {
      console.error("Top-N Redis read failed, falling back to Mongo:", err.message);
    }
    if (!ranked.length) ranked = (await rankFromMongo(hackathonId)).slice(0, top);

    const subIds = ranked.map((r) => r.submissionId);
    const subs   = await Submission.find({ _id: { $in: subIds } })
      .populate("team", "name")
      .select("ProjectName TagLine team")
      .lean();

    const subMap = {};
    subs.forEach((s) => { subMap[s._id.toString()] = s; });

    const enriched = ranked.map((r) => ({
      ...r,
      projectName: subMap[r.submissionId]?.ProjectName || "—",
      tagline:     subMap[r.submissionId]?.TagLine     || "",
      teamName:    subMap[r.submissionId]?.team?.name  || "—",
    }));

    res.status(200).json({ success: true, top, leaderboard: enriched });
  } catch (err) { next(err); }
};

// GET /api/leaderboard/:hackathonId/rank/:submissionId  — get rank of one submission
export const getSubmissionRank = async (req, res, next) => {
  try {
    const boardKey = `hack:${req.params.hackathonId}:leaderboard`;

    // ZREVRANK returns 0-based rank from top
    let rank = null, score = null;
    try {
      rank  = await redisClient.zRevRank(boardKey, req.params.submissionId);
      score = await redisClient.zScore(boardKey, req.params.submissionId);
    } catch (err) {
      console.error("Rank Redis read failed, falling back to Mongo:", err.message);
    }

    if (rank === null || rank === undefined) {
      const entry = (await rankFromMongo(req.params.hackathonId))
        .find((r) => r.submissionId === String(req.params.submissionId));
      if (!entry)
        return res.status(404).json({ success: false, message: "Submission not on leaderboard yet" });
      return res.status(200).json({
        success: true,
        submissionId: req.params.submissionId,
        rank:  entry.rank,
        score: entry.score,
      });
    }

    res.status(200).json({
      success: true,
      submissionId: req.params.submissionId,
      rank:  rank + 1,   // convert to 1-based
      score: parseFloat(parseFloat(score).toFixed(2)),
    });
  } catch (err) { next(err); }
};

// POST /api/leaderboard/:hackathonId/rebuild  — rebuild Redis from MongoDB (recovery)
export const rebuildLeaderboard = async (req, res, next) => {
  try {
    const hackId = req.params.hackathonId;

    const hack = await Hackathon.findById(hackId);
    if (!hack)
      return res.status(404).json({ success: false, message: "Hackathon not found" });
    if (hack.organiser.toString() !== req.user.id.toString())
      return res.status(403).json({ success: false, message: "Not authorized" });

    const scores = await Score.find({ hackathon: hackId });

    // Group by submission → compute average
    const map = {};
    scores.forEach((sc) => {
      const sid = sc.submission.toString();
      if (!map[sid]) map[sid] = { total: 0, count: 0 };
      map[sid].total += sc.totalScore || 0;
      map[sid].count += 1;
    });

    // This route's whole job is repopulating the Redis cache — there is nothing
    // to fall back to, so say so plainly instead of surfacing a raw 500.
    if (!redisClient.isReady)
      return res.status(503).json({ success: false, message: "Redis is unavailable — leaderboard is already serving from MongoDB, no rebuild needed" });

    const boardKey = `hack:${hackId}:leaderboard`;
    await redisClient.del(boardKey);

    // Batch insert with multi (replacement for pipeline in v4)
    const multi = redisClient.multi();
    Object.entries(map).forEach(([sid, { total, count }]) => {
      multi.zAdd(boardKey, { score: parseFloat((total / count).toFixed(4)), value: sid });
    });
    await multi.exec();

    res.status(200).json({
      success: true,
      message:  "Leaderboard rebuilt from MongoDB",
      entries:  Object.keys(map).length,
    });
  } catch (err) { next(err); }
};