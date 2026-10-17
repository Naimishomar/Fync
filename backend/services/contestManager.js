import Contest from '../models/coding/contest.model.js';
import User from '../models/user.model.js';
import Problem from '../models/coding/problem.model.js';
import CodingSubmission from '../models/coding/codingSubmission.model.js';

class ContestManager {
  /**
   * Record the result of a contest submission against the leaderboard.
   *
   * Nothing was writing to participant.score, so every contest ranked everyone
   * at zero and the leaderboard was decorative. Scoring is ICPC-style: points
   * for the first accepted solve of each problem, and a penalty in minutes —
   * time from contest start plus a fixed cost per earlier wrong attempt on
   * that same problem. Ranking is score desc, penalty asc, which answers "who
   * solved them first" directly.
   *
   * The update is a single conditional write. Two submissions landing in the
   * same second would otherwise both see "not yet solved" and award the points
   * twice; the $elemMatch guard makes the second one a no-op.
   */
  async recordSubmission({ contestId, userId, problemId, accepted }) {
    if (!contestId || !accepted) return null;

    // Only the contest's own problems score; any other accepted solve used to
    // count toward the standings too.
    const contest = await Contest.findOne({ _id: contestId, problems: problemId })
      .select('startTime penaltyPerWrongSubmission');
    if (!contest) return null;

    const problem = await Problem.findById(problemId).select('points');
    const now = new Date();

    // Only attempts made before this one count, and only on this problem.
    const wrongAttempts = await CodingSubmission.countDocuments({
      user: userId,
      contest: contestId,
      problem: problemId,
      status: { $ne: 'Accepted' },
    });

    const minutes = Math.max(0, Math.round((now - new Date(contest.startTime)) / 60000));
    const penalty = minutes + wrongAttempts * (contest.penaltyPerWrongSubmission ?? 5);

    const result = await Contest.updateOne(
      {
        _id: contestId,
        participants: { $elemMatch: { user: userId, 'solved.problem': { $ne: problemId } } },
      },
      {
        $push: { 'participants.$.solved': { problem: problemId, at: now, penalty } },
        $inc: { 'participants.$.score': problem?.points ?? 100, 'participants.$.penalty': penalty },
        $set: { 'participants.$.finishTime': now },
      },
    );

    return result.modifiedCount ? { points: problem?.points ?? 100, penalty } : null;
  }

  /**
   * Standings for a contest, ranked the same way finalizeContest ranks them.
   */
  async leaderboard(contestId) {
    const contest = await Contest.findById(contestId)
      .populate('problems', 'title points')
      .lean();
    if (!contest) return null;

    // Users are attached by hand rather than with populate: populate replaces a
    // deleted account's id with null, which loses the only thing that ties a
    // standings row to its submissions.
    const ids = contest.participants.map((p) => p.user).filter(Boolean);
    const users = await User.find({ _id: { $in: ids } }).select('username avatar').lean();
    const byId = new Map(users.map((u) => [String(u._id), u]));

    const rows = [...contest.participants]
      .filter((p) => p.enteredAt)
      .sort((a, b) => (b.score - a.score) || (a.penalty - b.penalty))
      .map((p, i) => ({
        rank: i + 1,
        userId: p.user,
        user: byId.get(String(p.user)) ?? null,
        score: p.score,
        penalty: p.penalty,
        solvedCount: p.solved?.length ?? 0,
        solved: (p.solved ?? []).map((s) => ({ problem: s.problem, at: s.at })),
      }));

    return { contest: { _id: contest._id, title: contest.title, status: contest.status,
                        startTime: contest.startTime, endTime: contest.endTime,
                        problems: contest.problems }, rows };
  }

  /**
   * Calculate and apply rating changes after a contest
   * @param {string} contestId 
   */
  async finalizeContest(contestId) {
    try {
      const contest = await Contest.findById(contestId).populate('participants.user');
      if (!contest || contest.status !== 'Ongoing') return;

      // Sort participants by score (desc) then finishTime (asc)
      const rankedParticipants = [...contest.participants].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        // Lower penalty wins. finishTime alone ranked someone who solved one
        // problem early above someone who solved three by the end.
        return (a.penalty ?? 0) - (b.penalty ?? 0);
      });

      // Simple Elo-style adjustment
      // In a real system, we compare every pair of users.
      // For simplicity, we'll adjust based on their rank vs expected rank.
      
      const K = 32; // K-factor
      for (let i = 0; i < rankedParticipants.length; i++) {
        const participant = rankedParticipants[i];
        const user = participant.user;
        if (!user) continue;

        const currentRating = user.codingRating || 1200;
        
        // Expected score based on average rating of other participants
        // (Simplified: if you are above median, you gain; below, you lose)
        const actualScore = (rankedParticipants.length - 1 - i) / (rankedParticipants.length - 1 || 1);
        
        // This is a very simplified rating change
        const ratingChange = Math.round(K * (actualScore - 0.5)); 
        
        await User.findByIdAndUpdate(user._id, {
          $inc: { codingRating: ratingChange },
          $push: { contestHistory: { contest: contest._id, rank: i + 1, ratingChange } }
        });
      }

      contest.status = 'Completed';
      await contest.save();
      
      console.log(`Contest ${contestId} finalized and ratings updated.`);
    } catch (error) {
      console.error('Contest Finalization Error:', error);
    }
  }

  /**
   * Check for contests that should start or end
   */
  async monitorContests(io) {
    const now = new Date();
    
    // Auto-start
    const toStart = await Contest.find({ 
      status: 'Upcoming', 
      startTime: { $lte: now } 
    });
    
    for (const c of toStart) {
      c.status = 'Ongoing';
      await c.save();
      io.emit('contest_started', { contestId: c._id, title: c.title });
    }

    // Auto-end
    const toEnd = await Contest.find({ 
      status: 'Ongoing', 
      endTime: { $lte: now } 
    });
    
    for (const c of toEnd) {
      await this.finalizeContest(c._id);
      io.emit('contest_ended', { contestId: c._id, title: c.title });
    }
  }
}

export default new ContestManager();
