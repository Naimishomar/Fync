import Problem from '../../models/coding/problem.model.js';
import Contest from '../../models/coding/contest.model.js';
import BugProblem from '../../models/coding/bugProblem.model.js';
import { searchProblems, fetchProblem } from '../../services/problemSource.service.js';
import { escapeRegExp } from '../../utils/escapeRegExp.js';

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
   * Search a public problem source (LeetCode, Codeforces) so a contest can be
   * assembled by picking problems instead of authoring them.
   */
  async searchExternal(req, res) {
    try {
      const results = await searchProblems({
        source: req.query.source,
        q: req.query.q,
        difficulty: req.query.difficulty,
        limit: req.query.limit,
      });
      return res.status(200).json({ success: true, results });
    } catch (error) {
      console.error('External Search Error:', error.message);
      return res.status(502).json({ success: false, message: `Source unavailable: ${error.message}` });
    }
  }

  /**
   * Show what an import would create, without writing it. Lets the admin read
   * the statement and the sample cases before committing junk to the bank.
   */
  async previewExternal(req, res) {
    try {
      const draft = await fetchProblem({ source: req.query.source, id: req.query.id });
      return res.status(200).json({ success: true, draft });
    } catch (error) {
      console.error('External Preview Error:', error.message);
      return res.status(502).json({ success: false, message: error.message });
    }
  }

  /**
   * Import a source problem into the bank.
   *
   * Only the sample cases exist publicly — no source publishes its hidden
   * tests — so an imported problem is judged on visible cases alone until an
   * admin adds more. Flagged on the document rather than assumed.
   */
  async importExternal(req, res) {
    try {
      const { source, id, overrides = {} } = req.body ?? {};
      if (!source || !id) {
        return res.status(400).json({ success: false, message: 'source and id are required.' });
      }

      const draft = await fetchProblem({ source, id });

      // Re-importing the same problem would silently duplicate it in the bank
      // and in any contest built from a search of that bank.
      const existing = await Problem.findOne({ sourceUrl: draft.sourceUrl });
      if (existing) {
        return res.status(409).json({ success: false, message: `Already imported as "${existing.title}".`, problem: existing });
      }

      const problem = await Problem.create({
        ...draft,
        ...overrides,
        points: overrides.points ?? { Easy: 100, Medium: 200, Hard: 300 }[draft.difficulty] ?? 100,
      });

      return res.status(201).json({
        success: true,
        problem,
        message: problem.testCases.length
          ? `Imported with ${problem.testCases.length} sample cases. Add hidden cases before running a contest on it.`
          : 'Imported without test cases — this source does not expose them. Add cases before use.',
      });
    } catch (error) {
      console.error('External Import Error:', error.message);
      return res.status(502).json({ success: false, message: error.message });
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
   * Bug mission bank, paginated the same way and without the fix.
   */
  async getBugProblems(req, res) {
    try {
      const { q, domain, difficulty, page = 1, limit = 24 } = req.query;
      const filter = {};
      if (domain) filter.domain = domain;
      if (difficulty) filter.difficulty = difficulty;
      if (q) filter.title = { $regex: escapeRegExp(q), $options: 'i' };

      const size = Math.min(Number(limit) || 24, 100);
      const skip = (Math.max(1, Number(page) || 1) - 1) * size;

      const [bugs, total] = await Promise.all([
        BugProblem.find(filter)
          .select('title difficulty domain language points buggyLines source createdAt')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(size)
          .lean(),
        BugProblem.countDocuments(filter),
      ]);

      // Domain totals drive the coverage panel: the whole point of the tracks is
      // that each one has enough missions at each level to be worth opening.
      const coverage = await BugProblem.aggregate([
        { $group: { _id: { domain: '$domain', difficulty: '$difficulty' }, count: { $sum: 1 } } },
      ]);

      res.status(200).json({ success: true, bugs, total, page: Number(page) || 1, pages: Math.ceil(total / size), coverage });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch bug mission bank' });
    }
  }

  /**
   * Problem bank listing for the admin UI.
   *
   * Paginated and projected: the bank is thousands of documents once seeded,
   * each with twenty test cases, and the old version sent all of them in full
   * on every page load. `contestReady` is computed here because "does this
   * problem have hidden cases" is the one thing an admin needs to know before
   * putting it in a contest, and it is not visible from the title.
   */
  async getProblems(req, res) {
    try {
      const { q, difficulty, source, page = 1, limit = 24 } = req.query;
      const filter = {};
      if (difficulty) filter.difficulty = difficulty;
      if (source) filter.source = source;
      if (q) filter.$or = [
        { title: { $regex: escapeRegExp(q), $options: 'i' } },
        { tags: { $regex: escapeRegExp(q), $options: 'i' } },
      ];

      const size = Math.min(Number(limit) || 24, 100);
      const skip = (Math.max(1, Number(page) || 1) - 1) * size;

      const [rows, total] = await Promise.all([
        Problem.find(filter)
          .select('title difficulty category tags points source sourceUrl createdAt testCases.isHidden')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(size)
          .lean(),
        Problem.countDocuments(filter),
      ]);

      const problems = rows.map(({ testCases = [], ...p }) => ({
        ...p,
        totalCases: testCases.length,
        hiddenCases: testCases.filter((tc) => tc.isHidden).length,
        contestReady: testCases.some((tc) => tc.isHidden) && testCases.some((tc) => !tc.isHidden),
      }));

      res.status(200).json({ success: true, problems, total, page: Number(page) || 1, pages: Math.ceil(total / size) });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch problem bank' });
    }
  }

  /**
   * Contest listing for the admin UI. The dashboard had a Contests tab that
   * rendered nothing because no endpoint fed it.
   */
  async getContests(req, res) {
    try {
      const contests = await Contest.find()
        .select('title status startTime endTime problems participants weeklyKey visibility')
        .sort({ startTime: -1 })
        .limit(100)
        .lean();

      res.status(200).json({
        success: true,
        contests: contests.map(({ problems = [], participants = [], ...c }) => ({
          ...c,
          problemCount: problems.length,
          participantCount: participants.length,
          enteredCount: participants.filter((p) => p.enteredAt).length,
        })),
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch contests' });
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
