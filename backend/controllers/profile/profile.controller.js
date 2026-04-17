import User from "../../models/user.model.js";
import UserProject from "../../models/profile/project.model.js";
import Internship from "../../models/profile/internship.model.js";
import Certificate from "../../models/profile/certificate.model.js";
import FyncScore from "../../models/profile/fyncScore.model.js";

// ─── Full Portfolio Aggregation ───────────────────────────────────────────────
// Returns everything needed to render a complete profile in one request
export const getFullProfile = async (req, res) => {
    try {
        const targetUserId = req.params.userId;
        const requesterId = req.user?._id?.toString();
        const isOwner = requesterId === targetUserId;

        const user = await User.findById(targetUserId).select(
            "-password -refreshToken -githubAccessToken -deviceId -deviceModel -location -redeemedItems"
        );
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        // Visibility gate
        if (!isOwner) {
            if (user.portfolioVisibility === "private") {
                return res.status(403).json({ success: false, message: "This portfolio is private" });
            }
            // "fync-only" — only authenticated users can see (already protected by auth middleware)
        }

        const visibilityFilter = isOwner ? {} : { isPublic: true };

        const [projects, internships, certs, scoreDoc] = await Promise.all([
            UserProject.find({ user: targetUserId, ...visibilityFilter })
                .populate("collaborators.user", "name username avatar")
                .sort({ isFeatured: -1, createdAt: -1 }),
            Internship.find({ user: targetUserId, ...visibilityFilter }).sort({ startDate: -1 }),
            Certificate.find({ user: targetUserId, ...visibilityFilter }).sort({ issueDate: -1 }),
            FyncScore.findOne({ user: targetUserId })
        ]);

        // Profile completeness calculation
        const completeness = calcCompleteness(user, projects, internships, certs);

        return res.json({
            success: true,
            profile: {
                user,
                projects,
                internships,
                certificates: certs,
                score: scoreDoc,
                completeness,
                isOwner
            }
        });
    } catch (error) {
        console.error("getFullProfile error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// ─── Profile Completeness ─────────────────────────────────────────────────────
const calcCompleteness = (user, projects, internships, certs) => {
    const checks = {
        basicInfo:     !!(user.avatar && user.about && user.college),       // 10%
        skills:        !!(user.skills?.length > 0 || user.interest),        // 10%
        socialLinks:   !!(user.github_id || user.linkedIn_id),              // 10%
        hasProject:    projects.length > 0,                                  // 20%
        hasWork:       internships.length > 0,                               // 20%
        codingProfiles:!!(user.codingProfiles?.leetcode || user.codingProfiles?.gfg), // 10%
        hasCert:       certs.length > 0,                                     // 10%
        githubConnected: !!user.githubUsername                               // 10%
    };

    const weights = {
        basicInfo: 10, skills: 10, socialLinks: 10,
        hasProject: 20, hasWork: 20, codingProfiles: 10,
        hasCert: 10, githubConnected: 10
    };

    let total = 0;
    const missing = [];
    for (const [key, passed] of Object.entries(checks)) {
        if (passed) total += weights[key];
        else missing.push(key);
    }

    return { percentage: total, checks, missing };
};

// ─── Update Portfolio Visibility ──────────────────────────────────────────────
export const updateVisibility = async (req, res) => {
    try {
        const { visibility } = req.body;
        if (!["public", "fync-only", "private"].includes(visibility))
            return res.status(400).json({ success: false, message: "Invalid visibility value" });

        await User.findByIdAndUpdate(req.user._id, { portfolioVisibility: visibility });
        return res.json({ success: true, message: `Portfolio visibility set to '${visibility}'` });
    } catch (error) {
        console.error("updateVisibility error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
