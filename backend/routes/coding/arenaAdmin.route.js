import express from 'express';
import { authMiddleware, isAdmin } from '../../middlewares/auth.middleware.js';
import ArenaAdminController from '../../controllers/coding/arenaAdmin.controller.js';

const router = express.Router();

// Apply security telemetry to all administrative signals
router.use(authMiddleware);
router.use(isAdmin);

/**
 * @route   POST /arena/admin/problems
 * @desc    Create a new coding problem
 */
router.post('/problems', ArenaAdminController.createProblem);
// Bulk paste — the practical way to add a problem set with its test cases.
router.post('/problems/import', ArenaAdminController.importProblems);

/**
 * @route   GET /arena/admin/problems
 * @desc    Get all problems for admin overview
 */
router.get('/problems', ArenaAdminController.getProblems);

/**
 * @route   POST /arena/admin/bug-problems
 * @desc    Create a new bug mission
 */
router.post('/bug-problems', ArenaAdminController.createBugProblem);

/**
 * @route   GET /arena/admin/bug-problems
 * @desc    Get all bug missions for admin overview
 */
router.get('/bug-problems', ArenaAdminController.getBugProblems);

/**
 * @route   POST /arena/admin/contests
 * @desc    Schedule a new contest
 */
router.post('/contests', ArenaAdminController.createContest);

/**
 * @route   GET /arena/admin/stats
 * @desc    Get administrative dashboard stats
 */
router.get('/stats', ArenaAdminController.getDashboardStats);

export default router;
