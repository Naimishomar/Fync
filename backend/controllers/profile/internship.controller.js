import Internship from "../../models/profile/internship.model.js";
import { calculateFyncScore } from "../../services/fyncScore.service.js";

// ─── Add Internship / Work Experience ─────────────────────────────────────────
export const createInternship = async (req, res) => {
    try {
        const userId = req.user._id;
        const {
            company, companyLogo, role, type, description, techStack,
            startDate, endDate, isCurrentlyWorking,
            location, workMode, isPublic
        } = req.body;

        if (!company || !role || !startDate)
            return res.status(400).json({ success: false, message: "company, role and startDate are required" });

        const internship = await Internship.create({
            user: userId,
            company, companyLogo, role,
            type: type || "internship",
            description,
            techStack: techStack || [],
            startDate: new Date(startDate),
            endDate: endDate ? new Date(endDate) : null,
            isCurrentlyWorking: isCurrentlyWorking || false,
            location,
            workMode: workMode || "remote",
            isPublic: isPublic !== false
        });

        calculateFyncScore(userId).catch(() => {});

        return res.status(201).json({ success: true, message: "Experience added!", internship });
    } catch (error) {
        console.error("createInternship error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// ─── Get User's Internships ───────────────────────────────────────────────────
export const getUserInternships = async (req, res) => {
    try {
        const targetUserId = req.params.userId;
        const isOwner = req.user?._id?.toString() === targetUserId;

        const filter = { user: targetUserId };
        if (!isOwner) filter.isPublic = true;

        const internships = await Internship.find(filter).sort({ startDate: -1 });

        return res.json({ success: true, internships });
    } catch (error) {
        console.error("getUserInternships error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// ─── Update Internship ────────────────────────────────────────────────────────
export const updateInternship = async (req, res) => {
    try {
        const internship = await Internship.findById(req.params.id);
        if (!internship) return res.status(404).json({ success: false, message: "Not found" });
        if (internship.user.toString() !== req.user._id.toString())
            return res.status(403).json({ success: false, message: "Not authorized" });

        const allowed = [
            "company", "companyLogo", "role", "type", "description", "techStack",
            "startDate", "endDate", "isCurrentlyWorking", "location", "workMode", "isPublic"
        ];
        allowed.forEach((f) => { if (req.body[f] !== undefined) internship[f] = req.body[f]; });
        await internship.save();

        calculateFyncScore(req.user._id).catch(() => {});
        return res.json({ success: true, internship });
    } catch (error) {
        console.error("updateInternship error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// ─── Delete Internship ────────────────────────────────────────────────────────
export const deleteInternship = async (req, res) => {
    try {
        const internship = await Internship.findById(req.params.id);
        if (!internship) return res.status(404).json({ success: false, message: "Not found" });
        if (internship.user.toString() !== req.user._id.toString())
            return res.status(403).json({ success: false, message: "Not authorized" });

        await internship.deleteOne();
        calculateFyncScore(req.user._id).catch(() => {});

        return res.json({ success: true, message: "Deleted" });
    } catch (error) {
        console.error("deleteInternship error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
