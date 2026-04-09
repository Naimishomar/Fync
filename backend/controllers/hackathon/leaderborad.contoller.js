import client from "../../utils/redis";
import Submission from "../../models/hackathon/submission.model.js";
import Score from "../../models/hackathon/score.model.js";
import Hackathon from "../../models/hackathon/hackathon.model.js";

// GET /api/leaderboard/:hackathonId  — live ranked list from Redis
exports.getLeaderboard = async (req, res, next) => {
  try {
    const hackId   = req.params.hackathonId;
    const boardKey = `hack:${hackId}:leaderboard`;

    // ZREVRANGEBYSCORE — highest score first, with scores
    const raw = await client.zrevrangebyscore(boardKey, "+inf", "-inf", "WITHSCORES");

    if (!raw.length)
      return res.status(200).json({ success: true, leaderboard: [], message: "No scores yet" });

    // Parse flat array [ subId, score, subId, score, ... ] into ranked list
    const ranked = [];
    for (let i = 0; i < raw.length; i += 2) {
      ranked.push({
        rank:         ranked.length + 1,
        submissionId: raw[i],
        score:        parseFloat(parseFloat(raw[i + 1]).toFixed(2)),
      });
    }

    // Hydrate with project + team info from MongoDB
    const subIds = ranked.map((r) => r.submissionId);
    const subs   = await Submission.find({ _id: { $in: subIds } })
      .populate("team", "name")
      .select("projectName tagline techStack team status");

    const subMap = {};
    subs.forEach((s) => { subMap[s._id.toString()] = s; });

    const enriched = ranked.map((r) => {
      const sub = subMap[r.submissionId] || {};
      return {
        rank:         r.rank,
        submissionId: r.submissionId,
        score:        r.score,
        projectName:  sub.projectName  || "—",
        tagline:      sub.tagline      || "",
        techStack:    sub.techStack    || [],
        teamName:     sub.team?.name   || "—",
        status:       sub.status       || "—",
      };
    });

    res.status(200).json({ success: true, hackathonId: hackId, leaderboard: enriched });
  } catch (err) { next(err); }
};

// GET /api/leaderboard/:hackathonId/top/:n  — top N teams
exports.getTopN = async (req, res, next) => {
  try {
    const { hackathonId, n } = req.params;
    const boardKey = `hack:${hackathonId}:leaderboard`;

    // ZREVRANGE with scores — top N
    const raw = await client.zrevrange(boardKey, 0, Number(n) - 1, "WITHSCORES");

    const ranked = [];
    for (let i = 0; i < raw.length; i += 2) {
      ranked.push({
        rank:         ranked.length + 1,
        submissionId: raw[i],
        score:        parseFloat(parseFloat(raw[i + 1]).toFixed(2)),
      });
    }

    const subIds = ranked.map((r) => r.submissionId);
    const subs   = await Submission.find({ _id: { $in: subIds } })
      .populate("team", "name")
      .select("projectName tagline team");

    const subMap = {};
    subs.forEach((s) => { subMap[s._id.toString()] = s; });

    const enriched = ranked.map((r) => ({
      ...r,
      projectName: subMap[r.submissionId]?.projectName || "—",
      tagline:     subMap[r.submissionId]?.tagline     || "",
      teamName:    subMap[r.submissionId]?.team?.name  || "—",
    }));

    res.status(200).json({ success: true, top: Number(n), leaderboard: enriched });
  } catch (err) { next(err); }
};

// GET /api/leaderboard/:hackathonId/rank/:submissionId  — get rank of one submission
exports.getSubmissionRank = async (req, res, next) => {
  try {
    const boardKey = `hack:${req.params.hackathonId}:leaderboard`;

    // ZREVRANK returns 0-based rank from top
    const rank  = await redisClient.zrevrank(boardKey, req.params.submissionId);
    const score = await redisClient.zscore(boardKey, req.params.submissionId);

    if (rank === null)
      return res.status(404).json({ success: false, message: "Submission not on leaderboard yet" });

    res.status(200).json({
      success: true,
      submissionId: req.params.submissionId,
      rank:  rank + 1,   // convert to 1-based
      score: parseFloat(parseFloat(score).toFixed(2)),
    });
  } catch (err) { next(err); }
};

// POST /api/leaderboard/:hackathonId/rebuild  — rebuild Redis from MongoDB (recovery)
exports.rebuildLeaderboard = async (req, res, next) => {
  try {
    const hackId = req.params.hackathonId;

    const hack = await Hackathon.findById(hackId);
    if (!hack)
      return res.status(404).json({ success: false, message: "Hackathon not found" });
    if (hack.organizer.toString() !== req.user._id.toString())
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

    const boardKey = `hack:${hackId}:leaderboard`;
    await redisClient.del(boardKey);

    // Batch insert with pipeline
    const pipeline = redisClient.pipeline();
    Object.entries(map).forEach(([sid, { total, count }]) => {
      pipeline.zadd(boardKey, parseFloat((total / count).toFixed(4)), sid);
    });
    await pipeline.exec();

    res.status(200).json({
      success: true,
      message:  "Leaderboard rebuilt from MongoDB",
      entries:  Object.keys(map).length,
    });
  } catch (err) { next(err); }
};