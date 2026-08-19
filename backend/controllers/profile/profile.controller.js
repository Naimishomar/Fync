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

        // The user document was awaited on its own before the other four
        // queries could start, purely because the visibility filter was derived
        // from it -- so every portfolio render paid two serial round trips
        // instead of one. The filter only decides what is *returned*, so fetch
        // everything concurrently and apply visibility afterwards, in memory.
        //
        // A viewer's own id is known from the token, so `isOwner` never depends
        // on the fetched document; nothing private can leak by starting early.
        const [user, allProjects, allInternships, allCerts, scoreDoc] = await Promise.all([
            User.findById(targetUserId)
                .select("-password -refreshToken -githubAccessToken -deviceId -deviceModel -location -redeemedItems -otp -otpExpires -otpAttempts")
                .lean(),
            UserProject.find({ user: targetUserId })
                .populate("collaborators.user", "name username avatar")
                .sort({ isFeatured: -1, createdAt: -1 })
                .lean(),
            Internship.find({ user: targetUserId })
                .sort({ startDate: -1 })
                .lean(),
            Certificate.find({ user: targetUserId })
                .sort({ issueDate: -1 })
                .lean(),
            FyncScore.findOne({ user: targetUserId })
                .lean()
        ]);

        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        // Visibility gate — unchanged in effect, just applied after the fetch.
        if (!isOwner && user.portfolioVisibility === "private") {
            return res.status(403).json({ success: false, message: "This portfolio is private" });
        }

        const visible = (rows) => (isOwner ? rows : rows.filter((r) => r.isPublic));
        const projects = visible(allProjects);
        const internships = visible(allInternships);
        const certs = visible(allCerts);

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
