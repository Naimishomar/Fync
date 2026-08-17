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

        const updateFields = { "codingStats.lastUpdated": new Date() };
        if (leetcodeSolved  !== undefined) updateFields["codingStats.leetcodeSolved"]  = Number(leetcodeSolved);
        if (leetcodeRating  !== undefined) updateFields["codingStats.leetcodeRating"]  = Number(leetcodeRating);
        if (gfgSolved       !== undefined) updateFields["codingStats.gfgSolved"]       = Number(gfgSolved);
        if (gfgRating       !== undefined) updateFields["codingStats.gfgRating"]        = Number(gfgRating);
        if (codechefSolved  !== undefined) updateFields["codingStats.codechefSolved"]  = Number(codechefSolved);
        if (codechefRating  !== undefined) updateFields["codingStats.codechefRating"]  = Number(codechefRating);
        if (codechef        !== undefined) updateFields["codingProfiles.codechef"]     = codechef;

        // Recompute totalSolved
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const lc = leetcodeSolved !== undefined ? Number(leetcodeSolved) : (user.codingStats?.leetcodeSolved || 0);
        const gfg = gfgSolved !== undefined ? Number(gfgSolved) : (user.codingStats?.gfgSolved || 0);
        const cc = codechefSolved !== undefined ? Number(codechefSolved) : (user.codingStats?.codechefSolved || 0);
        updateFields["codingStats.totalSolved"] = lc + gfg + cc;

        const updated = await User.findByIdAndUpdate(req.user._id, { $set: updateFields }, { new: true });
        return res.json({ success: true, codingStats: updated.codingStats, codingProfiles: updated.codingProfiles });
    } catch (error) {
        console.error("updateCodingStats error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
