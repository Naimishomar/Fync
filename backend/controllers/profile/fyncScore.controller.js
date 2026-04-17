import FyncScore from "../../models/profile/fyncScore.model.js";
import { calculateFyncScore } from "../../services/fyncScore.service.js";

// ─── Get Score for a User ─────────────────────────────────────────────────────
export const getScore = async (req, res) => {
    try {
        const userId = req.params.userId;

        let scoreDoc = await FyncScore.findOne({ user: userId });

        // Auto-create if it doesn't exist yet
        if (!scoreDoc) {
            scoreDoc = await calculateFyncScore(userId);
        }

        return res.json({ success: true, score: scoreDoc });
    } catch (error) {
        console.error("getScore error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// ─── Recalculate Score (self or admin) ───────────────────────────────────────
export const recalculateScore = async (req, res) => {
    try {
        const userId = req.user._id;
        const scoreDoc = await calculateFyncScore(userId);
        return res.json({ success: true, message: "Score recalculated!", score: scoreDoc });
    } catch (error) {
        console.error("recalculateScore error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
