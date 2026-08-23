import Problem from '../../models/coding/problem.model.js';
import BugProblem from '../../models/coding/bugProblem.model.js';
import CodingSubmission from '../../models/coding/codingSubmission.model.js';
import Contest from '../../models/coding/contest.model.js';
import { runSubmission } from '../../services/codeRunner.service.js';
import ContestManager from '../../services/contestManager.js';
import { canAttempt, domainOverview, ladderFor, solvedCounts } from '../../services/bugProgression.service.js';

/**
 * Controller for Coding Arena Problems and Submissions
 */

// GET /api/problems
export const getProblems = async (req, res) => {
  try {
    const { difficulty, tags } = req.query;
    const filter = {};
    if (difficulty) filter.difficulty = difficulty;
    if (tags) filter.tags = { $in: tags.split(',') };

    // Test cases are excluded entirely from the listing, not just their
    // isHidden flag. Selecting '-testCases.isHidden' removed the flag but kept
    // the inputs and expected outputs, so the problem list was handing out the
    // answers to every hidden case — the exact thing hiding them prevents.
    const problems = await Problem.find(filter)
      .select('-testCases')
      .sort({ difficulty: 1, createdAt: -1 })
      .lean();

    res.json({ success: true, problems });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/problems/:id
export const getProblemById = async (req, res) => {
  try {
    const { contestId } = req.query;
    let problem = await Problem.findById(req.params.id);
    
    if (!problem) {
      problem = await BugProblem.findById(req.params.id);
    }

    if (!problem) return res.status(404).json({ success: false, message: 'Problem not found' });
    
    // Security: If part of a contest and accessed via contestId, verify entry
    if (contestId) {
      const contest = await Contest.findById(contestId);
      if (contest) {
        const participant = contest.participants.find(p => p.user.toString() === req.user.id);
        if (!participant || !participant.enteredAt) {
          return res.status(403).json({ success: false, message: 'Signal Encrypted. Enter mission contest to decrypt problem data.' });
        }
      }
    }

    // The ladder is enforced here, not only in the listing: a greyed-out card is
    // a CSS class, and the id is guessable from any earlier response.
    if (problem.domain) {
      const gate = await canAttempt(req.user.id, problem);
      if (!gate.allowed) return res.status(403).json({ success: false, locked: true, message: gate.message });
    }

    // Hide hidden test cases from client
    const publicTestCases = problem.testCases.filter(tc => !tc.isHidden);
    const problemObj = problem.toObject();
    problemObj.testCases = publicTestCases;
    // The working version is the answer. It is only revealed once the student
    // has an accepted submission on this problem.
    if (problemObj.fixedCode) {
      const solved = await CodingSubmission.exists({ user: req.user.id, problem: problem._id, status: 'Accepted' });
      if (!solved) delete problemObj.fixedCode;
    }

    res.json({ success: true, problem: problemObj });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/bug-problems/:id
export const getBugProblemById = async (req, res) => {
  try {
    const { contestId } = req.query;
    const problem = await BugProblem.findById(req.params.id);
    if (!problem) return res.status(404).json({ success: false, message: 'Bug mission not found' });
    
    // Security: Verify contest entry if applicable
    if (contestId) {
      const contest = await Contest.findById(contestId);
      if (contest) {
        const participant = contest.participants.find(p => p.user.toString() === req.user.id);
        if (!participant || !participant.enteredAt) {
          return res.status(403).json({ success: false, message: 'Signal Encrypted. Enter mission contest to decrypt bug mission data.' });
        }
      }
    }

    // Hide hidden test cases from client
    const publicTestCases = problem.testCases.filter(tc => !tc.isHidden);
    const problemObj = problem.toObject();
    problemObj.testCases = publicTestCases;

    res.json({ success: true, problem: problemObj });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/problems/submit
export const submitSolution = async (req, res) => {
  try {
    const { problemId, code, languageId, contestId } = req.body;
    const userId = req.user.id;

    let problem = await Problem.findById(problemId);
    
    // Check if it's a bug problem if not found in standard problems
    if (!problem) {
      problem = await BugProblem.findById(problemId);
    }

    if (!problem) return res.status(404).json({ success: false, message: 'Problem not found' });

    // Same ladder check as the detail endpoint. Without it a locked Hard bug is
    // still solvable by posting its id straight to the judge.
    if (problem.domain) {
      const gate = await canAttempt(userId, problem);
      if (!gate.allowed) return res.status(403).json({ success: false, locked: true, message: gate.message });
    }

    // Contest Validation (Time Limit Enforcement)
    if (contestId) {
      const contest = await Contest.findById(contestId);
      if (contest) {
        const now = new Date();
        if (now < new Date(contest.startTime)) {
          return res.status(403).json({ success: false, message: 'Contest has not started yet' });
        }
        if (now > new Date(contest.endTime)) {
          return res.status(403).json({ success: false, message: 'Contest has already ended. Access Revoked.' });
        }
      }
    }

    // Create a new submission record
    const submission = await CodingSubmission.create({
      user: userId,
      problem: problemId,
      contest: contestId || null,
      code,
      languageId,
      language: req.body.language || 'javascript',
      status: 'Pending'
    });

    // One judge request for every test case, not one per case.
    //
    // This used to loop the cases, submitting each and then polling for up to
    // fifteen seconds. A forty-case problem was forty submissions and could
    // take ten minutes of wall time; with two thousand students in a contest it
    // was never going to finish. The runner batches them into a single
    // execution, coalesces identical submissions and caches verdicts.
    const language = req.body.language || 'javascript';
    const verdict = await runSubmission({
      language,
      code,
      cases: problem.testCases,
      problemId: String(problemId),
      timeLimitMs: problem.timeLimit || 2000,
    });

    const passedCount = verdict.passed;
    const finalStatus = verdict.status;

    // Only public cases come back to the client. The runner is given every
    // case including hidden ones, and returning its results unfiltered would
    // hand out the hidden inputs and expected outputs mid-contest.
    const visibleResults = (verdict.results || [])
      .map((r, i) => ({ r, hidden: problem.testCases[i]?.isHidden }))
      .filter((x) => !x.hidden)
      .map((x, i) => ({
        case: i + 1,
        passed: x.r.passed,
        got: x.r.got,
        expected: x.r.expected,
        error: x.r.error ? String(x.r.error).slice(0, 400) : null,
      }));

    submission.status = finalStatus;
    
    submission.passedCount = passedCount;
    submission.totalCount = problem.testCases.length;
    submission.executionTime = Math.round((verdict.time || 0) * 1000);
    submission.memoryUsage = verdict.memory || 0;
    
    await submission.save();

    // Award contest points here rather than at finalize time: the penalty is
    // measured from the moment the solve lands, and a batch pass at the end
    // has no way to reconstruct it.
    const award = await ContestManager.recordSubmission({
      contestId,
      userId,
      problemId,
      accepted: finalStatus === 'Accepted',
    });

    res.json({ 
      success: true, 
      award,
      submission: {
        id: submission._id,
        status: submission.status,
        passedCount,
        totalCount: submission.totalCount,
        executionTime: submission.executionTime,
        memoryUsage: submission.memoryUsage,
        results: visibleResults,
        // Present when the program never ran: a compile error or a crash.
        message: verdict.message ?? null,
      }
    });

  } catch (error) {
    console.error('Submission Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/bug-problems
export const getBugProblems = async (req, res) => {
  try {
    const { domain, difficulty, page = 1, limit = 24 } = req.query;
    const filter = {};
    if (domain) filter.domain = domain;
    if (difficulty) filter.difficulty = difficulty;

    // The buggy code, the fix and the test cases are all withheld from the
    // listing. A seeded bank is thousands of documents; sending each one whole
    // would be megabytes, and `fixedCode` is the answer.
    const size = Math.min(Number(limit) || 24, 100);
    const skip = (Math.max(1, Number(page) || 1) - 1) * size;

    const [problems, total] = await Promise.all([
      BugProblem.find(filter)
        .select('title difficulty domain language points buggyLines createdAt')
        .sort({ difficulty: 1, createdAt: -1 })
        .skip(skip)
        .limit(size)
        .lean(),
      BugProblem.countDocuments(filter),
    ]);

    // Which of these the student has already fixed, so the list can mark them
    // instead of making them remember.
    const solvedIds = new Set(
      (await CodingSubmission.find({
        user: req.user.id,
        status: 'Accepted',
        problem: { $in: problems.map((p) => p._id) },
      }).distinct('problem')).map(String),
    );

    const counts = domain ? (await solvedCounts(req.user.id))[domain] : null;

    res.json({
      success: true,
      problems: problems.map((p) => ({ ...p, solved: solvedIds.has(String(p._id)) })),
      total,
      page: Number(page) || 1,
      pages: Math.ceil(total / size),
      ladder: counts !== null ? ladderFor(counts) : null,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /arena/bug-domains — the picker: which tracks exist and what is open.
export const getBugDomains = async (req, res) => {
  try {
    res.json({ success: true, domains: await domainOverview(req.user.id) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
