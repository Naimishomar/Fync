import FundingProject from "../models/funding.model.js";
import User from "../models/user.model.js";
import Comment from "../models/comment.model.js";
import { deleteFromR2 } from "../utils/r2.js";
import crypto from 'crypto';

export const createFundingPost = async (req, res) => {
    try {
        const { title, description, deployed_url, github_url, paymentRefId, razorpay_order_id, razorpay_signature } = req.body;
        if (!title || !description || !deployed_url) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        // Payment verification is REQUIRED for every new project.
        if (!paymentRefId || !razorpay_order_id || !razorpay_signature) {
            return res.status(400).json({ success: false, message: "Payment verification failed" });
        }

        const body = razorpay_order_id + "|" + paymentRefId;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest("hex");

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ success: false, message: "Invalid payment signature" });
        }
        let image = [];
        let video = "";
        if (req.files?.image) image = req.files.image.map(f => f.path);
        if (req.files?.video?.[0]) video = req.files.video[0].path;

        if (image.length === 0 && !video) {
            return res.status(400).json({ message: "At least one image or video required" });
        }

        const project = await FundingProject.create({
            user: req.user.id,
            title, description, image, video, deployed_url, github_url,
            likes: 0, liked_by: [], comments: [],
            paymentRefId: paymentRefId || null
        });
        res.status(201).json({ success: true, message: "Project created", project });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};


export const getAllProjects = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        const projects = await FundingProject.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .populate("user", "name username avatar");

        const total = await FundingProject.countDocuments();

        if (!projects || projects.length === 0) {
            return res.status(404).json({ success: false, message: 'Projects not found' });
        }

        return res.status(200).json({
            success: true,
            message: 'Projects fetched successfully',
            projects,
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

export const getYourProjects = async (req, res) => {
    try {
        const projects = await FundingProject.find({ user: req.user.id });
        if (!projects) {
            return res.status(404).json({ success: false, message: "Projects not found" });
        }
        return res.status(200).json({ success: true, message: "Projects fetched successfully", projects });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const updateProject = async (req, res) => {
    try {
        const project = await FundingProject.findById(req.params.id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found" });

        // Ensure user ID matches safely
        const userId = req.user.id || req.user._id;
        if (project.user.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }

        let newImages = undefined;
        let newVideo = undefined;

        // If new images uploaded, delete old images from R2
        if (req.files?.image && req.files.image.length > 0) {
            newImages = req.files.image.map(f => f.path);
            if (project.image && Array.isArray(project.image)) {
                const deletions = project.image.map(imgUrl => deleteFromR2(imgUrl));
                await Promise.allSettled(deletions);
            }
        }

        // If new video uploaded, delete old video from R2
        if (req.files?.video && req.files.video.length > 0) {
            newVideo = req.files.video[0].path;
            if (project.video) {
                await deleteFromR2(project.video);
            }
        }

        const updatedProject = await FundingProject.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    ...(req.body.title && { title: req.body.title }),
                    ...(req.body.description && { description: req.body.description }),
                    ...(newImages !== undefined && { image: newImages }),
                    ...(newVideo !== undefined && { video: newVideo }),
                    ...(req.body.deployed_url && { deployed_url: req.body.deployed_url }),
                    ...(req.body.github_url !== undefined && { github_url: req.body.github_url }),
                },
            },
            { new: true }
        ).populate("user");

        return res.status(200).json({ success: true, message: "Project updated successfully", project: updatedProject });
    } catch (error) {
        console.log("Update error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const likeAndUnlikeProject = async (req, res) => {
    try {
        const project = await FundingProject.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ success: false, message: "Project not found" });
        }
        const isLiked = (project.liked_by || []).some(id => String(id) === String(req.user.id));
        let updatedProject;
        if (isLiked) {
            updatedProject = await FundingProject.findByIdAndUpdate(
                req.params.id,
                {
                    $inc: { likes: -1 },
                    $pull: { liked_by: req.user.id }
                },
                { new: true }
            );
            return res.status(200).json({ success: true, message: "Project unliked successfully", project: updatedProject });
        }
        else {
            updatedProject = await FundingProject.findByIdAndUpdate(
                req.params.id,
                {
                    $inc: { likes: 1 },
                    $addToSet: { liked_by: req.user.id }
                },
                { new: true }
            );
            return res.status(200).json({ success: true, message: "Project liked successfully", project: updatedProject });
        }
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const addComment = async (req, res) => {
    try {
        const { text, parentCommentId } = req.body;
        if (!text) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }
        const project = await FundingProject.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ success: false, message: "Project not found" });
        }

        let replyToUser = null;
        if (parentCommentId) {
            const parent = await Comment.findById(parentCommentId);
            if (parent) {
                replyToUser = parent.commentor;
            }
        }

        const comment = await Comment.create({
            text,
            commentor: req.user.id,
            post: req.params.id,
            postType: "FundingProject",
            parentComment: parentCommentId || null,
            replyToUser: replyToUser || null
        })

        if (parentCommentId && replyToUser && replyToUser.toString() !== req.user.id) {
             // Optional: Add notification for funding reply if needed
        }

        const commenterDetails = await Comment.findById(comment._id)
            .populate("commentor", "name avatar username")
            .populate("replyToUser", "username");

        return res.status(200).json({ success: true, message: "Comment created successfully", comment: commenterDetails });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const getAllComments = async (req, res) => {
    try {
        const comments = await Comment.find({ post: req.params.id, postType: "FundingProject", parentComment: null })
            .sort({ createdAt: -1 })
            .populate("commentor", "name avatar username");
        
        const commentsWithReplies = await Promise.all(comments.map(async (comment) => {
            const replies = await Comment.find({ parentComment: comment._id })
                .populate("commentor", "name avatar username")
                .populate("replyToUser", "username")
                .sort({ createdAt: 1 });
            return { ...comment._doc, replies };
        }));

        const totalComments = commentsWithReplies.length;
        return res.status(200).json({ success: true, message: "Comments fetched successfully", comments: commentsWithReplies, totalComments });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error", });
    }
};

export const deleteComment = async (req, res) => {
    try {
        const comment = await Comment.find({ post: req.params.id, postType: "FundingProject" });
        if (!comment) {
            return res.status(404).json({ success: false, message: "Comment not found" });
        }
        if (comment.commentor.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        await Comment.findOneAndDelete({ post: req.params.id });
        return res.status(200).json({ success: true, message: "Comment deleted successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};


export const deleteFundingProject = async (req, res) => {
    try {
        const project = await FundingProject.findById(req.params.id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found" });

        // Ensure user ID matches safely
        const userId = req.user.id || req.user._id;
        if (project.user.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }

        // DELETE FILES FROM R2
        const deletions = [];
        if (project.image && Array.isArray(project.image)) {
            project.image.forEach(imgUrl => deletions.push(deleteFromR2(imgUrl)));
        }
        if (project.video) {
            deletions.push(deleteFromR2(project.video));
        }
        await Promise.allSettled(deletions);
        await FundingProject.findByIdAndDelete(req.params.id);

        // Also delete associated comments to keep the database clean
        await Comment.deleteMany({ post: req.params.id, postType: "FundingProject" });

        return res.status(200).json({ success: true, message: "Project deleted successfully" });
    } catch (error) {
        console.log("Delete error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}