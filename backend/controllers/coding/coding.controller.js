import Problem from '../../models/coding/problem.model.js';
import BugProblem from '../../models/coding/bugProblem.model.js';
import CodingSubmission from '../../models/coding/codingSubmission.model.js';
import Contest from '../../models/coding/contest.model.js';
import Judge0Service from '../../services/judge0.service.js';

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

    // Run against test cases (Batch submission to Judge0)
    let passedCount = 0;
    const results = [];

    console.log(`🚀 Starting sanitization for problem ${problemId} (Target: ${problem.testCases.length} cases)`);

    for (let i = 0; i < problem.testCases.length; i++) {
      const testCase = problem.testCases[i];
      console.log(`📡 Dispatching Case #${i + 1} to Judge0...`);
      
      const token = await Judge0Service.submitCode(code, languageId, testCase.input, testCase.expectedOutput);
      
      // Poll for result
      let result;
      let attempts = 0;
      while (attempts < 15) { 
        console.log(`   ⏱️ Polling Case #${i + 1} (Attempt ${attempts + 1}/15)...`);
        result = await Judge0Service.getSubmission(token);
        if (result.status.id > 2) {
          console.log(`   ✅ Case #${i + 1} finalized with status: ${result.status.description}`);
          break; 
        }
        await new Promise(r => setTimeout(r, 1000));
        attempts++;
      }

      if (attempts >= 15) {
        console.warn(`   ⚠️ Case #${i + 1} timed out during polling.`);
        result = { status: { id: 13, description: 'Internal Timeout' } };
      }

      results.push(result);
      if (result.status.id === 3) passedCount++; 
    }

    console.log(`🏁 Sanitization complete. Passed: ${passedCount}/${problem.testCases.length}`);

    // Update submission record
    submission.passedCount = passedCount;
    submission.totalCount = problem.testCases.length;
    
    // Normalize status description to fit enum
    let finalStatus = passedCount === problem.testCases.length ? 'Accepted' : 'Wrong Answer';
    const failedTestCase = results.find(r => r.status.id !== 3);
    
    if (failedTestCase) {
      const desc = failedTestCase.status.description;
      if (desc.includes('Runtime Error')) finalStatus = 'Runtime Error';
      else if (desc === 'Time Limit Exceeded') finalStatus = 'Time Limit Exceeded';
      else if (desc === 'Memory Limit Exceeded') finalStatus = 'Memory Limit Exceeded';
      else if (desc === 'Compilation Error') finalStatus = 'Compilation Error';
      else if (desc === 'Internal Error') finalStatus = 'Internal Error';
      else if (desc === 'Internal Timeout') finalStatus = 'Internal Timeout';
      else if (desc === 'Exec Format Error') finalStatus = 'Exec Format Error';
      else finalStatus = 'Wrong Answer';
    }

    submission.status = finalStatus;
    
    // Set execution metrics
    submission.executionTime = results.length > 0 ? Math.max(...results.map(r => r.time || 0)) * 1000 : 0;
    submission.memoryUsage = results.length > 0 ? Math.max(...results.map(r => r.memory || 0)) : 0;
    
    await submission.save();

    res.json({ 
      success: true, 
      submission: {
        id: submission._id,
        status: submission.status,
        passedCount,
        totalCount: submission.totalCount,
        executionTime: submission.executionTime,
        memoryUsage: submission.memoryUsage
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
