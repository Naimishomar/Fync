import Problem from '../../models/coding/problem.model.js';
import BugProblem from '../../models/coding/bugProblem.model.js';
import CodingSubmission from '../../models/coding/codingSubmission.model.js';
import Contest from '../../models/coding/contest.model.js';
import { runSubmission } from '../../services/codeRunner.service.js';

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

    const problems = await Problem.find(filter).select('-testCases.isHidden');
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

    // Hide hidden test cases from client
    const publicTestCases = problem.testCases.filter(tc => !tc.isHidden);
    const problemObj = problem.toObject();
    problemObj.testCases = publicTestCases;

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

    res.json({ 
      success: true, 
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
    const problems = await BugProblem.find();
    res.json({ success: true, problems });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
