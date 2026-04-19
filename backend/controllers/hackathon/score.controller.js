import Score from "../../models/hackathon/score.model.js";
import Submission from "../../models/hackathon/submission.model.js";
import Hackathon from "../../models/hackathon/hackathons.model.js";
import redisClient from "../../utils/redis.js";

// ─── helper: recalculate aggregate score across all judges ───
const recalcAndUpdateBoard = async (hackId, subId, io) => {
  const allScores = await Score.find({ submission: subId });
  if (!allScores.length) return;

  const avg = allScores.reduce((s, sc) => s + (sc.totalScore || 0), 0) / allScores.length;
  const rounded = parseFloat(avg.toFixed(4));

  // Update Redis sorted set
  const boardKey = `hack:${hackId}:leaderboard`;
  await redisClient.zAdd(boardKey, { score: rounded, value: subId.toString() });

  // Broadcast to all clients watching this hackathon
  if (io) {
    io.to(`hack:${hackId}`).emit("leaderboard:updated", {
      submissionId: subId,
      newScore:     parseFloat(avg.toFixed(2)),
      judgeCount:   allScores.length,
    });
  }

  return rounded;
};

// POST /api/scores  — judge submits or updates score
export const submitScore = async (req, res, next) => {
  try {
    const { submission: subId, criteria, feedback } = req.body;

    const sub = await Submission.findById(subId).populate("hackathon");
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
    await recalcAndUpdateBoard(hack._id, subId, io);

    // Check if all judges have scored this submission → mark as scored
    const scoreCount = await Score.countDocuments({ submission: subId });
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
      .populate("judge", "name avatar");

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
    }).select("_id ProjectName team");

    // Submissions this judge already scored
    const scored = await Score.find({
      hackathon: hackId,
      judge:     req.user.id,
    }).select("submission");

    const scoredIds = new Set(scored.map((s) => s.submission.toString()));

    const pending = allSubs.filter((s) => !scoredIds.has(s._id.toString()));
     res.status(200).json({ success: true, pending, pendingCount: pending.length });
   } catch (err) { next(err); }
 };

// GET /api/scores/judge/scored/:hackathonId — submissions a judge HAS already scored
export const getScoredByJudge = async (req, res, next) => {
  try {
    const hackId = req.params.hackathonId;

    const scores = await Score.find({
      hackathon: hackId,
      judge:     req.user.id,
    })
    .populate({
      path: "submission",
      select: "_id ProjectName team status",
      populate: { path: "team", select: "name members" }
    })
    .sort({ updatedAt: -1 });

    res.status(200).json({ success: true, scored: scores, scoredCount: scores.length });
  } catch (err) { next(err); }
};