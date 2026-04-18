import UserProject from "../../models/profile/project.model.js";
import { calculateFyncScore } from "../../services/fyncScore.service.js";

// ─── Create Project ───────────────────────────────────────────────────────────
export const createProject = async (req, res) => {
    try {
        const userId = req.user._id;
        const {
            title, tagline, description, longDescription,
            techStack, githubUrl, liveUrl, images,
            videoDemo, status, startDate, endDate,
            hackathon, tags, isFeatured, isPublic
        } = req.body;

        if (!title) return res.status(400).json({ success: false, message: "Project title is required" });

        const project = await UserProject.create({
            user: userId,
            title, tagline, description, longDescription,
            techStack: techStack || [],
            githubUrl, liveUrl,
            images: req.files?.map(f => f.path) || [],
            videoDemo, status,
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null,
            hackathon: hackathon || null,
            tags: tags || [],
            isFeatured: isFeatured || false,
            isPublic: isPublic !== false
        });

        // Async score update — don't block response
        calculateFyncScore(userId).catch(() => {});

        return res.status(201).json({ success: true, message: "Project added!", project });
    } catch (error) {
        console.error("createProject error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// ─── Get Projects for a User ──────────────────────────────────────────────────
export const getUserProjects = async (req, res) => {
    try {
        const targetUserId = req.params.userId;
        const requesterId = req.user?._id?.toString();
        const isOwner = requesterId === targetUserId;

        const filter = { user: targetUserId };
        if (!isOwner) filter.isPublic = true;

        const projects = await UserProject.find(filter)
            .populate("collaborators.user", "name username avatar")
            .sort({ isFeatured: -1, createdAt: -1 });

        return res.json({ success: true, projects });
    } catch (error) {
        console.error("getUserProjects error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// ─── Get Single Project ───────────────────────────────────────────────────────
export const getProject = async (req, res) => {
    try {
        const project = await UserProject.findById(req.params.id)
            .populate("user", "name username avatar fyncScore fyncBadge")
            .populate("collaborators.user", "name username avatar");

        if (!project) return res.status(404).json({ success: false, message: "Project not found" });

        // Increment view count
        project.views = (project.views || 0) + 1;
        await project.save();

        return res.json({ success: true, project });
    } catch (error) {
        console.error("getProject error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// ─── Update Project ───────────────────────────────────────────────────────────
export const updateProject = async (req, res) => {
    try {
        const project = await UserProject.findById(req.params.id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found" });
        if (project.user.toString() !== req.user._id.toString())
            return res.status(403).json({ success: false, message: "Not authorized" });

        const allowed = [
            "title", "tagline", "description", "longDescription",
            "techStack", "githubUrl", "liveUrl", "images",
            "videoDemo", "status", "startDate", "endDate",
            "tags", "isFeatured", "isPublic"
        ];
        allowed.forEach((field) => {
            if (req.body[field] !== undefined) project[field] = req.body[field];
        });

        // Add new uploaded images if any
        if (req.files && req.files.length > 0) {
            const newImages = req.files.map(f => f.path);
            project.images = [...(project.images || []), ...newImages];
        }

        await project.save();
        calculateFyncScore(req.user._id).catch(() => {});

        return res.json({ success: true, message: "Project updated", project });
    } catch (error) {
        console.error("updateProject error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// ─── Delete Project ───────────────────────────────────────────────────────────
export const deleteProject = async (req, res) => {
    try {
        const project = await UserProject.findById(req.params.id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found" });
        if (project.user.toString() !== req.user._id.toString())
            return res.status(403).json({ success: false, message: "Not authorized" });

        await project.deleteOne();
        calculateFyncScore(req.user._id).catch(() => {});

        return res.json({ success: true, message: "Project deleted" });
    } catch (error) {
        console.error("deleteProject error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// ─── Toggle Like ─────────────────────────────────────────────────────────────
export const toggleProjectLike = async (req, res) => {
    try {
        const project = await UserProject.findById(req.params.id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found" });

        const userId = req.user._id;
        const idx = project.likes.indexOf(userId);
        if (idx === -1) {
            project.likes.push(userId);
        } else {
            project.likes.splice(idx, 1);
        }
        await project.save();

        // Update project owner's score
        calculateFyncScore(project.user).catch(() => {});

        return res.json({ success: true, likes: project.likes.length, liked: idx === -1 });
    } catch (error) {
        console.error("toggleProjectLike error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// ─── Toggle Featured ─────────────────────────────────────────────────────────
export const toggleFeatured = async (req, res) => {
    try {
        const project = await UserProject.findById(req.params.id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found" });
        if (project.user.toString() !== req.user._id.toString())
            return res.status(403).json({ success: false, message: "Not authorized" });

        project.isFeatured = !project.isFeatured;
        await project.save();

        return res.json({ success: true, isFeatured: project.isFeatured });
    } catch (error) {
        console.error("toggleFeatured error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
