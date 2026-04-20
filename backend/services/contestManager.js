import Contest from '../models/coding/contest.model.js';
import User from '../models/user.model.js';

class ContestManager {
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
        return a.finishTime - b.finishTime;
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
