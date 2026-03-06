import Notice from "../models/notice.model.js";
import Comment from "../models/comment.model.js";
import { tryCatch } from "bullmq";
import User from "../models/user.model.js";

export const createNotice = async (req, res) => {
    try {
        const { title, description, link } = req.body;
        if (!title || !description) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }
        let noticeImage = "";
        if (req.files && req.files.length > 0) {
            noticeImage = req.files.map(file => file.path);
        }
        const notice = await Notice.create({
            title,
            description,
            link,
            user: req.user.id,
            college: req.user.college,
            image: noticeImage,
            user: req.user.id,
            college: req.user.college
        })
        return res.status(200).json({ success: true, message: "Notice created successfully", notice });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const createGlobalNotice = async (req, res) => {
    try {
        const { title, description, link } = req.body;
        if (!title || !description) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }
        let noticeImage = "";
        if (req.files && req.files.length > 0) {
            noticeImage = req.files.map(file => file.path);
        }
        if (req.user.email !== process.env.ADMIN_EMAIL) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        const user = await User.findOne({ email: process.env.ADMIN_EMAIL });
        const notice = await Notice.create({
            title,
            description,
            link,
            image: noticeImage,
            user: user._id,
            college: user.college,
        })
        return res.status(200).json({ success: true, message: "Notice created successfully", notice });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const getGlobalNotices = async (req, res) => {
    try {
        const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
        const user = await User.findOne({ email: ADMIN_EMAIL });
        if (!user) {
            return res.status(200).json({ success: true, message: "No admin configured", notices: [] });
        }
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        const notices = await Notice.find({ user: user._id })
            .sort({ createdAt: -1 })
            .populate("user", "name avatar username")
            .skip(skip)
            .limit(Number(limit));

        const total = await Notice.countDocuments({ user: user._id });

        return res.status(200).json({
            success: true,
            message: "Notices fetched successfully",
            notices,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const getCollegeNotices = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        const notices = await Notice.find({ college: req.user.college })
            .sort({ createdAt: -1 })
            .populate("user", "name avatar username")
            .skip(skip)
            .limit(Number(limit));

        const total = await Notice.countDocuments({ college: req.user.college });

        return res.status(200).json({
            success: true,
            message: "Notices fetched successfully",
            notices,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const deleteNotice = async (req, res) => {
    try {
        const notice = await Notice.findById(req.params.id);
        if (!notice) {
            return res.status(404).json({ success: false, message: "No notice found" });
        }
        if (notice.user.toString() !== req.user.id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        await Notice.findByIdAndDelete(req.params.id);
        return res.status(200).json({ success: true, message: "Notice deleted successfully", notice });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const UpdateNotice = async (req, res) => {
    try {
        const { title, description, link } = req.body;
        const notice = await Notice.findById(req.params.id);
        if (!notice) {
            return res.status(404).json({ success: false, message: "No notice found" });
        }
        if (notice.user.toString() !== req.user.id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        let noticeImage = "";
        if (req.files && req.files.length > 0) {
            noticeImage = req.files.map(file => file.path);
        }
        notice.title = title;
        notice.description = description;
        notice.link = link;
        notice.image = noticeImage;
        await notice.save();
        return res.status(200).json({ success: true, message: "Notice updated successfully", notice });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const addComment = async (req, res) => {
    try {
        const { text } = req.body;
        const { id } = req.params;
        if (!text) {
            return res.status(400).json({ success: false, message: "Comment text is required" });
        }
        const notice = await Notice.findById(id);
        if (!notice) {
            return res.status(404).json({ success: false, message: "Notice not found" });
        }
        const comment = await Comment.create({
            text,
            commentor: req.user.id,
            post: id,
            postType: "Notice"
        });
        notice.comments.push(comment._id);
        await notice.save();
        const populatedComment = await Comment.findById(comment._id).populate("commentor", "name username avatar");
        return res.status(200).json({ success: true, message: "Comment added successfully", comment: populatedComment });
    } catch (error) {
        console.log("Add comment error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getComments = async (req, res) => {
    try {
        const { id } = req.params;
        const comments = await Comment.find({ post: id, postType: "Notice" })
            .sort({ createdAt: -1 }) // Newest first
            .populate("commentor", "name username avatar");
        return res.status(200).json({ success: true, comments });
    } catch (error) {
        console.log("Get comments error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const updateComment = async (req, res) => {
    try {
        const { id } = req.params;
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ success: false, message: "Text is required" });
        }
        const comment = await Comment.findById(id);
        if (!comment) {
            return res.status(404).json({ success: false, message: "Comment not found" });
        }
        if (comment.commentor.toString() !== req.user.id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        comment.text = text;
        await comment.save();
        return res.status(200).json({ success: true, message: "Comment updated", comment });
    } catch (error) {
        console.log("Update comment error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const deleteComment = async (req, res) => {
    try {
        const { id } = req.params;
        const comment = await Comment.findById(id);
        if (!comment) {
            return res.status(404).json({ success: false, message: "Comment not found" });
        }
        if (comment.commentor.toString() !== req.user.id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        await Comment.findByIdAndDelete(id);
        await Notice.findByIdAndUpdate(comment.post, {
            $pull: { comments: id }
        });
        return res.status(200).json({ success: true, message: "Comment deleted successfully" });
    } catch (error) {
        console.log("Delete comment error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};