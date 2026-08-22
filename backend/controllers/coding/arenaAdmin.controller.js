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
   * Import problems in bulk from pasted JSON.
   *
   * Typing forty test cases into a form on a phone is not a thing anyone will
   * do, so problems are authored wherever it is comfortable and pasted in as
   * JSON. Accepts one object or an array.
   *
   * Validation is strict and per-problem: a malformed entry is reported by
   * index and skipped rather than aborting the batch, so pasting thirty
   * problems with one typo imports twenty-nine instead of nothing.
   */
  async importProblems(req, res) {
    try {
      const payload = Array.isArray(req.body) ? req.body : req.body?.problems ?? [req.body];
      if (!Array.isArray(payload) || !payload.length) {
        return res.status(400).json({ success: false, message: 'Paste a problem object or an array of them.' });
      }
      if (payload.length > 100) {
        return res.status(400).json({ success: false, message: 'Import at most 100 problems at a time.' });
      }

      const created = [];
      const errors = [];

      for (let i = 0; i < payload.length; i++) {
        const p = payload[i] ?? {};
        const problems = [];

        if (!p.title?.trim()) problems.push('title is required');
        if (!p.description?.trim()) problems.push('description is required');
        if (!Array.isArray(p.testCases) || p.testCases.length === 0) {
          problems.push('testCases must be a non-empty array');
        } else {
          // expectedOutput may legitimately be "0" or "false", so this checks
          // for presence rather than truthiness.
          const bad = p.testCases.findIndex(
            (tc) => tc?.input === undefined || tc?.expectedOutput === undefined,
          );
          if (bad !== -1) problems.push(`testCases[${bad}] needs both input and expectedOutput`);
          // A problem where every case is hidden shows the student nothing to
          // check their work against before submitting.
          if (p.testCases.every((tc) => tc?.isHidden)) problems.push('at least one test case must be visible');
        }
        if (p.difficulty && !['Easy', 'Medium', 'Hard'].includes(p.difficulty)) {
          problems.push('difficulty must be Easy, Medium or Hard');
        }

        if (problems.length) {
          errors.push({ index: i, title: p.title ?? '(untitled)', problems });
          continue;
        }

        try {
          const doc = await Problem.create({
            title: p.title.trim(),
            description: p.description.trim(),
            difficulty: p.difficulty ?? 'Easy',
            category: p.category ?? 'General',
            tags: Array.isArray(p.tags) ? p.tags : [],
            testCases: p.testCases.map((tc) => ({
              input: String(tc.input),
              expectedOutput: String(tc.expectedOutput),
              isHidden: Boolean(tc.isHidden),
            })),
            starterCode: p.starterCode ?? {},
            constraints: Array.isArray(p.constraints) ? p.constraints : [],
            timeLimit: p.timeLimit ?? 2000,
            memoryLimit: p.memoryLimit ?? 256,
            points: p.points ?? 100,
          });
          created.push({ id: doc._id, title: doc.title, cases: doc.testCases.length });
        } catch (err) {
          errors.push({ index: i, title: p.title, problems: [err.message] });
        }
      }

      return res.status(created.length ? 201 : 400).json({
        success: created.length > 0,
        created,
        errors,
        message: `${created.length} imported, ${errors.length} rejected.`,
      });
    } catch (error) {
      console.error('Import Problems Error:', error);
      return res.status(500).json({ success: false, message: 'Import failed.' });
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
