import Problem from '../../models/coding/problem.model.js';
import Contest from '../../models/coding/contest.model.js';
import BugProblem from '../../models/coding/bugProblem.model.js';

/**
 * Controller for administrative tasks in the Coding Arena
 */
class ArenaAdminController {
  /**
   * Create a new coding problem
   */
  async createProblem(req, res) {
    try {
      const { 
        title, 
        description, 
        difficulty, 
        category, 
        tags, 
        testCases, 
        starterCode, 
        constraints, 
        timeLimit, 
        memoryLimit, 
        points 
      } = req.body;

      const problem = new Problem({
        title,
        description,
        difficulty,
        category,
        tags,
        testCases,
        starterCode,
        constraints,
        timeLimit,
        memoryLimit,
        points
      });

      await problem.save();

      res.status(201).json({
        success: true,
        message: 'Problem synchronized with the bank',
        problem
      });
    } catch (error) {
      console.error('Create Problem Error:', error);
      res.status(500).json({ success: false, message: 'Failed to record problem signal' });
    }
  }

  /**
   * Create a new bug mission
   */
  async createBugProblem(req, res) {
    try {
      const { 
        title, 
        description, 
        buggyCode, 
        starterCode,
        difficulty, 
        language,
        testCases, 
        points 
      } = req.body;

      const bugProblem = new BugProblem({
        title,
        description,
        buggyCode,
        starterCode,
        difficulty,
        language,
        testCases,
        points
      });

      await bugProblem.save();

      res.status(201).json({
        success: true,
        message: 'Bug mission synchronized with the laboratory',
        bugProblem
      });
    } catch (error) {
      console.error('Create Bug Problem Error:', error);
      res.status(500).json({ success: false, message: 'Failed to record bug mission signal' });
    }
  }

  /**
   * Get all bug problems for admin overview
   */
  async getBugProblems(req, res) {
    try {
      const bugs = await BugProblem.find().sort({ createdAt: -1 });
      res.status(200).json({ success: true, bugs });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch bug mission bank' });
    }
  }

  /**
   * Get all problems for admin overview
   */
  async getProblems(req, res) {
    try {
      const problems = await Problem.find().sort({ createdAt: -1 });
      res.status(200).json({ success: true, problems });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch problem bank' });
    }
  }

  /**
   * Create a new scheduled contest
   */
  async createContest(req, res) {
    try {
      const { 
        title, 
        description, 
        problems, 
        startTime, 
        endTime, 
        prizePool, 
        visibility, 
        inviteCode,
        penaltyPerWrongSubmission
      } = req.body;

      const contest = new Contest({
        title,
        description,
        problems,
        startTime,
        endTime,
        prizePool,
        visibility,
        inviteCode,
        penaltyPerWrongSubmission,
        host: req.user.id,
        status: 'Upcoming'
      });

      await contest.save();

      res.status(201).json({
        success: true,
        message: 'Mission scheduled successfully',
        contest
      });
    } catch (error) {
      console.error('Create Contest Error:', error);
      res.status(500).json({ success: false, message: 'Failed to schedule contest' });
    }
  }

  /**
   * Get admin dashboard summary stats
   */
  async getDashboardStats(req, res) {
    try {
      const totalProblems = await Problem.countDocuments();
      const totalContests = await Contest.countDocuments();
      const totalBugs = await BugProblem.countDocuments();
      const ongoingContests = await Contest.countDocuments({ status: 'Ongoing' });
      
      res.status(200).json({
        success: true,
        stats: {
          totalProblems,
          totalContests,
          totalBugs,
          ongoingContests
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch tactical stats' });
    }
  }
}

export default new ArenaAdminController();
