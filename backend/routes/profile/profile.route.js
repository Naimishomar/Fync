import express from "express";
import { authMiddleware as verifyToken } from "../../middlewares/auth.middleware.js";

// Controllers
import { createProject, getUserProjects, getProject, updateProject, deleteProject, toggleProjectLike, toggleFeatured } from "../../controllers/profile/project.controller.js";
import { createInternship, getUserInternships, updateInternship, deleteInternship } from "../../controllers/profile/internship.controller.js";
import { createCertificate, getUserCertificates, updateCertificate, deleteCertificate } from "../../controllers/profile/certificate.controller.js";
import { getScore, recalculateScore } from "../../controllers/profile/fyncScore.controller.js";
import { getGitHubOAuthUrl, githubOAuthCallback, syncGitHub, disconnectGitHub } from "../../controllers/profile/github.controller.js";
import { getFullProfile, updateVisibility } from "../../controllers/profile/profile.controller.js";
import { generateResumePDF } from "../../controllers/profile/resume.controller.js";

const router = express.Router();

// ─── Full Profile ─────────────────────────────────────────────────────────────
router.get("/full/:userId",        verifyToken, getFullProfile);
router.patch("/visibility",        verifyToken, updateVisibility);

// ─── Projects ─────────────────────────────────────────────────────────────────
router.post("/projects",                          verifyToken, createProject);
router.get("/projects/single/:id",                verifyToken, getProject);        // ⚠️ must be before /:userId
router.get("/projects/:userId",                   verifyToken, getUserProjects);
router.patch("/projects/:id",                     verifyToken, updateProject);
router.delete("/projects/:id",                    verifyToken, deleteProject);
router.post("/projects/:id/like",                 verifyToken, toggleProjectLike);
router.post("/projects/:id/feature",              verifyToken, toggleFeatured);


// ─── Internships / Work Experience ───────────────────────────────────────────
router.post("/internships",                       verifyToken, createInternship);
router.get("/internships/:userId",                verifyToken, getUserInternships);
router.patch("/internships/:id",                  verifyToken, updateInternship);
router.delete("/internships/:id",                 verifyToken, deleteInternship);

// ─── Certificates ─────────────────────────────────────────────────────────────
router.post("/certificates",                      verifyToken, createCertificate);
router.get("/certificates/:userId",               verifyToken, getUserCertificates);
router.patch("/certificates/:id",                 verifyToken, updateCertificate);
router.delete("/certificates/:id",               verifyToken, deleteCertificate);

// ─── Fync Score ───────────────────────────────────────────────────────────────
router.get("/score/:userId",                      verifyToken, getScore);
router.post("/score/recalculate",                 verifyToken, recalculateScore);

// ─── GitHub OAuth ─────────────────────────────────────────────────────────────
router.get("/github/connect",                     verifyToken, getGitHubOAuthUrl);
router.get("/github/callback",                    githubOAuthCallback);   // no auth — GitHub redirects here
router.post("/github/sync",                       verifyToken, syncGitHub);
router.delete("/github/disconnect",               verifyToken, disconnectGitHub);

// ─── Resume ───────────────────────────────────────────────────────────────────
// PDF download (no auth — shareable public link)
router.get("/resume/:userId/pdf",                 generateResumePDF);
// Shareable link: the web/ Next.js app handles the actual HTML page at /u/:username

export default router;
