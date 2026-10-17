import User from "../../models/user.model.js";

// ─── Update / Add Education Entry ────────────────────────────────────────────
export const addEducation = async (req, res) => {
    try {
        const { institution, degree, field, grade, startYear, endYear, isCurrent, description } = req.body;
        if (!institution) return res.status(400).json({ success: false, message: "Institution is required" });

        const user = await User.findByIdAndUpdate(
            req.user._id,
            {
                $push: {
                    education: { institution, degree, field, grade, startYear, endYear, isCurrent: isCurrent || false, description }
                }
            },
            { new: true }
        );
        return res.json({ success: true, message: "Education added", education: user.education });
    } catch (error) {
        console.error("addEducation error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// ─── Update a single education entry ─────────────────────────────────────────
export const updateEducation = async (req, res) => {
    try {
        const { eduId } = req.params;
        const updates = req.body;

        // Build $set for subdocument fields
        const setFields = {};
        const allowed = ["institution", "degree", "field", "grade", "startYear", "endYear", "isCurrent", "description"];
        allowed.forEach(k => { if (updates[k] !== undefined) setFields[`education.$.${k}`] = updates[k]; });

        const user = await User.findOneAndUpdate(
            { _id: req.user._id, "education._id": eduId },
            { $set: setFields },
            { new: true }
        );
        if (!user) return res.status(404).json({ success: false, message: "Entry not found" });
        return res.json({ success: true, education: user.education });
    } catch (error) {
        console.error("updateEducation error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// ─── Delete education entry ───────────────────────────────────────────────────
export const deleteEducation = async (req, res) => {
    try {
        const { eduId } = req.params;
        const user = await User.findByIdAndUpdate(
            req.user._id,
            { $pull: { education: { _id: eduId } } },
            { new: true }
        );
        return res.json({ success: true, education: user.education });
    } catch (error) {
        console.error("deleteEducation error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// ─── Update Coding Stats (Self-reported from profile page) ───────────────────
export const updateCodingStats = async (req, res) => {
    try {
        const {
            leetcodeSolved, leetcodeRating,
            gfgSolved, gfgRating,
            codechefSolved, codechefRating,
            codechef  // username
        } = req.body;

        const user = await User.findById(req.user._id).select("codingStats codingProfiles");
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        // Self-reported numbers feed the leaderboard, so they are clamped to
        // something a human could have solved, and a platform with a linked
        // username keeps its synced value — typing over it no longer wins.
        const clamp = (v, max) => {
            const n = Math.trunc(Number(v));
            return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : undefined;
        };
        const leetcodeLinked = Boolean(user.codingProfiles?.leetcode);
        const gfgLinked = Boolean(user.codingProfiles?.gfg);

        const updateFields = { "codingStats.lastUpdated": new Date() };
        const set = (field, value, max) => {
            const n = clamp(value, max);
            if (value !== undefined && n !== undefined) updateFields[`codingStats.${field}`] = n;
        };
        if (!leetcodeLinked) { set("leetcodeSolved", leetcodeSolved, 5000); set("leetcodeRating", leetcodeRating, 5000); }
        if (!gfgLinked)      { set("gfgSolved", gfgSolved, 5000);           set("gfgRating", gfgRating, 50000); }
        set("codechefSolved", codechefSolved, 5000);
        set("codechefRating", codechefRating, 5000);
        if (codechef !== undefined) updateFields["codingProfiles.codechef"] = String(codechef).trim().slice(0, 50);

        // Recompute totalSolved
        const pick = (field) => updateFields[`codingStats.${field}`] ?? (user.codingStats?.[field] || 0);
        updateFields["codingStats.totalSolved"] =
            pick("leetcodeSolved") + pick("gfgSolved") + pick("codechefSolved") +
            (user.codingStats?.codeforcesSolved || 0) + (user.codingStats?.hackerrankSolved || 0);

        const updated = await User.findByIdAndUpdate(req.user._id, { $set: updateFields }, { new: true });
        return res.json({ success: true, codingStats: updated.codingStats, codingProfiles: updated.codingProfiles });
    } catch (error) {
        console.error("updateCodingStats error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
