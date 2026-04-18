import express from "express";
import { authMiddleware as verifyToken } from "../../middlewares/auth.middleware.js";

// Controllers
import { createProject, getUserProjects, getProject, updateProject, deleteProject, toggleProjectLike, toggleFeatured } from "../../controllers/profile/project.controller.js";
import { createInternship, getUserInternships, updateInternship, deleteInternship } from "../../controllers/profile/internship.controller.js";
import { createCertificate, getUserCertificates, updateCertificate, deleteCertificate } from "../../controllers/profile/certificate.controller.js";
import { getScore, recalculateScore } from "../../controllers/profile/fyncScore.controller.js";
import { getGitHubOAuthUrl, githubOAuthCallback, syncGitHub, disconnectGitHub } from "../../controllers/profile/github.controller.js";
import { getFullProfile, updateVisibility } from "../../controllers/profile/profile.controller.js";
import { generateResumePDF, uploadResume } from "../../controllers/profile/resume.controller.js";
import { addEducation, updateEducation, deleteEducation, updateCodingStats } from "../../controllers/profile/education.controller.js";
import { resumeUpload, upload } from "../../utils/r2.js";
import { r2UploadMiddleware } from "../../utils/r2Upload.js";

const router = express.Router();

// ─── Full Profile ─────────────────────────────────────────────────────────────
router.get("/full/:userId",        verifyToken, getFullProfile);
router.patch("/visibility",        verifyToken, updateVisibility);

// ─── Projects ─────────────────────────────────────────────────────────────────
router.post("/projects",                          verifyToken, upload.array('images', 5), r2UploadMiddleware({ images: 'projects' }), createProject);
router.get("/projects/single/:id",                verifyToken, getProject);        // ⚠️ must be before /:userId
router.get("/projects/:userId",                   verifyToken, getUserProjects);
router.patch("/projects/:id",                     verifyToken, upload.array('images', 5), r2UploadMiddleware({ images: 'projects' }), updateProject);
router.delete("/projects/:id",                    verifyToken, deleteProject);
router.post("/projects/:id/like",                 verifyToken, toggleProjectLike);
router.post("/projects/:id/feature",              verifyToken, toggleFeatured);


// ─── Internships / Work Experience ───────────────────────────────────────────
router.post("/internships",                       verifyToken, upload.fields([{ name: 'offerLetter', maxCount: 1 }, { name: 'completionCertificate', maxCount: 1 }]), r2UploadMiddleware({ offerLetter: 'verification/offer_letters', completionCertificate: 'verification/certificates' }), createInternship);
router.get("/internships/:userId",                verifyToken, getUserInternships);
router.patch("/internships/:id",                  verifyToken, upload.fields([{ name: 'offerLetter', maxCount: 1 }, { name: 'completionCertificate', maxCount: 1 }]), r2UploadMiddleware({ offerLetter: 'verification/offer_letters', completionCertificate: 'verification/certificates' }), updateInternship);
router.delete("/internships/:id",                 verifyToken, deleteInternship);

// ─── Certificates ─────────────────────────────────────────────────────────────
router.post("/certificates",                      verifyToken, upload.single('image'), r2UploadMiddleware({ __single__: 'certificates' }), createCertificate);
router.get("/certificates/:userId",               verifyToken, getUserCertificates);
router.patch("/certificates/:id",                 verifyToken, upload.single('image'), r2UploadMiddleware({ __single__: 'certificates' }), updateCertificate);
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
router.post("/resume/upload",                     verifyToken, resumeUpload.single('resume'), r2UploadMiddleware({ __single__: 'resumes' }), uploadResume);

// ─── Education ────────────────────────────────────────────────────────────────
router.post("/education",                         verifyToken, addEducation);
router.patch("/education/:eduId",                 verifyToken, updateEducation);
router.delete("/education/:eduId",               verifyToken, deleteEducation);

// ─── Coding Stats (Self-reported) ─────────────────────────────────────────────
router.patch("/coding-stats",                    verifyToken, updateCodingStats);

export default router;
