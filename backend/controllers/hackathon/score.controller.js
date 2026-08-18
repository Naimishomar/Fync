import Score from "../../models/hackathon/score.model.js";
import Submission from "../../models/hackathon/submission.model.js";
import Hackathon from "../../models/hackathon/hackathons.model.js";
import redisClient from "../../utils/redis.js";

// ─── helper: recalculate aggregate score across all judges ───
const recalcAndUpdateBoard = async (hackId, subId, io) => {
  const allScores = await Score.find({ submission: subId });
  if (!allScores.length) return 0;

  const avg = allScores.reduce((s, sc) => s + (sc.totalScore || 0), 0) / allScores.length;
  const rounded = parseFloat(avg.toFixed(4));

  // Update Redis sorted set. Best-effort only: the scores live in Mongo and
  // getLeaderboard rebuilds from there, so a dead cache must never be able to
  // reject a judge's score — that used to 500 the entire judging flow.
  const boardKey = `hack:${hackId}:leaderboard`;
  try {
    await redisClient.zAdd(boardKey, { score: rounded, value: subId.toString() });
  } catch (err) {
    console.error("Leaderboard cache write failed (scores still saved):", err.message);
  }

  // Broadcast to all clients watching this hackathon (both main + leaderboard rooms)
  if (io) {
    const payload = {
      submissionId: subId,
      newScore:     parseFloat(avg.toFixed(2)),
      judgeCount:   allScores.length,
    };
    io.to(`hack:${hackId}`).emit("leaderboard:updated", payload);
    io.to(`hack:${hackId}:leaderboard`).emit("leaderboard:updated", payload);
  }

  return allScores.length;
};

// POST /api/scores  — judge submits or updates score
export const submitScore = async (req, res, next) => {
  try {
    const { submission: subId, criteria, feedback } = req.body;

    // Only the fields needed for validation — not the whole hackathon doc
    const sub = await Submission.findById(subId).populate("hackathon", "judges status judgingcriteria");
    if (!sub)
      return res.status(404).json({ success: false, message: "Submission not found" });

    const hack = sub.hackathon;

    // Must be an assigned judge
    const isJudge = hack.judges.map(String).includes(req.user.id.toString());
    if (!isJudge)
      return res.status(403).json({ success: false, message: "You are not a judge for this hackathon" });

    // Hackathon must be in judging phase
    if (hack.status !== "judging")
      return res.status(400).json({ success: false, message: "Hackathon is not in judging phase" });

    // Validate criteria match hackathon's judging criteria
    const hackCriteria = hack.judgingcriteria.map((c) => c.name);
    const submittedCriteria = criteria.map((c) => c.name);
    const allValid = submittedCriteria.every((name) => hackCriteria.includes(name));
    if (!allValid)
      return res.status(400).json({ success: false, message: "Criteria do not match hackathon's judging criteria" });

    // Upsert: one score per judge per submission
    const score = await Score.findOneAndUpdate(
      { submission: subId, judge: req.user.id },
      {
        hackathon:  hack._id,
        submission: subId,
        judge:      req.user.id,
        criteria,
        feedback,
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    // Mark submission as underReview if still draft/submitted
    if (["submitted", "draft"].includes(sub.status)) {
      sub.status = "underReview";
      await sub.save();
    }

    // Recalc aggregate and push to Redis + socket
    const io = req.app.get("io");
    const scoreCount = await recalcAndUpdateBoard(hack._id, subId, io);

    // Check if all judges have scored this submission → mark as scored
    if (scoreCount >= hack.judges.length) {
      sub.status = "scored";
      await sub.save();

      if (io) {
        io.to(`hack:${hack._id}`).emit("submission:scored", {
          submissionId: subId,
          projectName:  sub.ProjectName,
        });
      }
    }

    res.status(200).json({ success: true, score });
  } catch (err) { next(err); }
};

// GET /api/scores/:submissionId  — full score breakdown
export const getScores = async (req, res, next) => {
  try {
    const scores = await Score.find({ submission: req.params.submissionId })
      .populate("judge", "name avatar")
      .lean();

    const avg = scores.length
      ? scores.reduce((s, sc) => s + (sc.totalScore || 0), 0) / scores.length
      : 0;

    // Per-criteria average across all judges
    const criteriaMap = {};
    scores.forEach((sc) => {
      sc.criteria.forEach((c) => {
        if (!criteriaMap[c.name]) criteriaMap[c.name] = { total: 0, count: 0, weightage: c.weightage };
        criteriaMap[c.name].total += c.score || 0;
        criteriaMap[c.name].count += 1;
      });
    });

    const criteriaAverages = Object.entries(criteriaMap).map(([name, val]) => ({
      name,
      weightage: val.weightage,
      average:   parseFloat((val.total / val.count).toFixed(2)),
    }));

    res.status(200).json({
      success: true,
      averageScore:     parseFloat(avg.toFixed(2)),
      judgeCount:       scores.length,
      criteriaAverages,
      scores,
    });
  } catch (err) { next(err); }
};

// GET /api/scores/judge/pending/:hackathonId  — submissions a judge hasn't scored yet
export const getPendingForJudge = async (req, res, next) => {
  try {
    const hackId = req.params.hackathonId;

    // All active submissions for this hackathon
    const allSubs = await Submission.find({
      hackathon: hackId,
      status:    { $in: ["submitted", "underReview"] },
    }).select("_id ProjectName team").lean();

    // Submissions this judge already scored
    const scored = await Score.find({
      hackathon: hackId,
      judge:     req.user.id,
    }).select("submission").lean();

    const scoredIds = new Set(scored.map((s) => s.submission.toString()));

    const pending = allSubs.filter((s) => !scoredIds.has(s._id.toString()));
     res.status(200).json({ success: true, pending, pendingCount: pending.length });
   } catch (err) { next(err); }
 };

// GET /api/scores/judge/scored/:hackathonId — submissions a judge HAS already scored
export const getScoredByJudge = async (req, res, next) => {
  try {
    const hackId = req.params.hackathonId;

    // A nested populate (score -> submission -> team) is three dependent waits.
    // Fetching the submissions and their teams as two flat, parallel queries and
    // stitching them in memory costs two.
    const scores = await Score.find({ hackathon: hackId, judge: req.user.id })
      .sort({ updatedAt: -1 })
      .lean();

    if (!scores.length)
      return res.status(200).json({ success: true, scored: [], scoredCount: 0 });

    const subs = await Submission.find({ _id: { $in: scores.map((s) => s.submission) } })
      .select("_id ProjectName team status")
      .populate("team", "name members")
      .lean();

    const subById = new Map(subs.map((s) => [s._id.toString(), s]));
    const scored = scores.map((s) => ({ ...s, submission: subById.get(s.submission.toString()) ?? null }));

    res.status(200).json({ success: true, scored, scoredCount: scored.length });
  } catch (err) { next(err); }
};