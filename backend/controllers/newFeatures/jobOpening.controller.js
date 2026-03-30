import JobOpening from "../../models/newFeatures/jobOpening.model.js";
import Comment from "../../models/comment.model.js";
import Notification from "../../models/notification.model.js";
import User from "../../models/user.model.js";

export const createJobOpening = async (req, res) => {
    try {
        const { title, description, applyLink, salary } = req.body;

        if (req.user.user_access !== 'alumni') {
            return res.status(403).json({ success: false, message: "Only alumni can post job openings" });
        }

        if (!title || !description || !applyLink) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        const jobOpening = await JobOpening.create({
            alumni: req.user.id,
            title,
            description,
            applyLink,
            salary: salary || "Not disclosed",
            college: req.user.college
        });

        return res.status(201).json({ success: true, message: "Job opening posted successfully", jobOpening });
    } catch (error) {
        console.error("Create Job Opening Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getJobOpenings = async (req, res) => {
    try {
        const { college } = req.user;
        const jobOpenings = await JobOpening.find({ college })
            .populate("alumni", "name username avatar company role")
            .sort({ createdAt: -1 });

        return res.status(200).json({ success: true, jobOpenings });
    } catch (error) {
        console.error("Get Job Openings Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const deleteJobOpening = async (req, res) => {
    try {
        const { id } = req.params;
        const jobOpening = await JobOpening.findById(id);

        if (!jobOpening) {
            return res.status(404).json({ success: false, message: "Job opening not found" });
        }

        if (jobOpening.alumni.toString() !== req.user.id.toString()) {
            return res.status(403).json({ success: false, message: "You are not authorized to delete this post" });
        }

        await JobOpening.findByIdAndDelete(id);
        // Also delete associated comments
        await Comment.deleteMany({ post: id, postType: 'JobOpening' });

        return res.status(200).json({ success: true, message: "Job opening deleted successfully" });
    } catch (error) {
        console.error("Delete Job Opening Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const addComment = async (req, res) => {
    try {
        const { id } = req.params;
        const { text, parentCommentId } = req.body;

        const jobOpening = await JobOpening.findById(id);
        if (!jobOpening) {
            return res.status(404).json({ success: false, message: "Job opening not found" });
        }

        let replyToUser = null;
        if (parentCommentId) {
            const parent = await Comment.findById(parentCommentId);
            if (parent) replyToUser = parent.commentor;
        }

        const comment = await Comment.create({
            text,
            commentor: req.user.id,
            post: id,
            postType: 'JobOpening',
            parentComment: parentCommentId || null,
            replyToUser: replyToUser || null
        });

        jobOpening.comments.push(comment._id);
        await jobOpening.save();

        if (jobOpening.alumni.toString() !== req.user.id.toString()) {
            await Notification.create({
                recipient: jobOpening.alumni,
                sender: req.user.id,
                type: 'comment',
                post: id,
                commentText: `commented on your job opening: "${text.substring(0, 20)}..."`
            });
        }
        
        if (replyToUser && replyToUser.toString() !== req.user.id.toString()) {
            await Notification.create({
                recipient: replyToUser,
                sender: req.user.id,
                type: 'reply',
                post: id,
                commentText: `replied to your comment: "${text.substring(0, 20)}..."`
            });
        }

        const populatedComment = await Comment.findById(comment._id).populate("commentor", "name username avatar");

        return res.status(201).json({ success: true, comment: populatedComment });
    } catch (error) {
        console.error("Add Comment Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getComments = async (req, res) => {
    try {
        const { id } = req.params;
        const topLevelComments = await Comment.find({ 
            post: id, 
            postType: 'JobOpening', 
            parentComment: null 
        })
        .populate("commentor", "name username avatar")
        .sort({ createdAt: -1 });

        const commentsWithReplies = await Promise.all(topLevelComments.map(async (comment) => {
            const replies = await Comment.find({ parentComment: comment._id })
                .populate("commentor", "name username avatar")
                .populate("replyToUser", "username")
                .sort({ createdAt: 1 });
            return { ...comment._doc, replies };
        }));

        return res.status(200).json({ success: true, comments: commentsWithReplies });
    } catch (error) {
        console.error("Get Comments Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
