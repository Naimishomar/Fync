import PlacementQuestion from "../models/newFeatures/placementHub.model.js";
import User from "../models/user.model.js";
import Comment from "../models/comment.model.js";
import Notification from "../models/notification.model.js";
import { clearCacheTags } from "../middlewares/cache.middleware.js";
import { getCommentThread } from "../utils/comments.js";

export const addQuestion = async (req, res) => {
    try {
        const { company, role, round, type, difficulty, question, description } = req.body;
        if (!company || !role || !round || !type || !difficulty || !question) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        const newQuestion = await PlacementQuestion.create({
            company,
            role,
            round,
            type,
            difficulty,
            question,
            description,
            postedBy: req.user.id
        });

        const populated = await newQuestion.populate("postedBy", "name avatar username");
        clearCacheTags(['placement']).catch(() => { });
        res.status(201).json({ success: true, message: "Question shared successfully", data: populated });
    } catch (error) {
        console.error("Error in addQuestion:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getQuestions = async (req, res) => {
    try {
        const { company, role, type, difficulty, search } = req.query;
        let filter = {};
        if (company) filter.company = new RegExp(company, 'i');
        if (role) filter.role = new RegExp(role, 'i');
        if (type) filter.type = type;
        if (difficulty) filter.difficulty = difficulty;
        if (search) {
            filter.$or = [
                { question: new RegExp(search, 'i') },
                { company: new RegExp(search, 'i') },
                { description: new RegExp(search, 'i') }
            ];
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;

        const questions = await PlacementQuestion.find(filter)
            .populate("postedBy", "name avatar username")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.status(200).json({ 
            success: true, 
            data: questions,
            hasMore: questions.length === limit
        });
    } catch (error) {
        console.error("Error in getQuestions:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const upvoteQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const question = await PlacementQuestion.findById(id);
        if (!question) return res.status(404).json({ success: false, message: "Question not found" });

        const hasUpvoted = (question.upvotes || []).some(uid => String(uid) === String(req.user.id));
        if (hasUpvoted) {
            question.upvotes = question.upvotes.filter(uid => uid.toString() !== req.user.id);
        } else {
            question.upvotes.push(req.user.id);
        }

        await question.save();
        clearCacheTags(['placement', `placement:${id}`]).catch(() => { });
        res.status(200).json({ success: true, upvotes: question.upvotes.length, hasUpvoted: !hasUpvoted });
    } catch (error) {
        console.error("Error in upvoteQuestion:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const addComment = async (req, res) => {
    try {
        const { id } = req.params;
        const { text, parentCommentId } = req.body;
        if (!text) return res.status(400).json({ success: false, message: "Comment text is required" });

        const question = await PlacementQuestion.findById(id);
        if (!question) return res.status(404).json({ success: false, message: "Question not found" });

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
            post: id,
            postType: "PlacementQuestion",
            parentComment: parentCommentId || null,
            replyToUser: replyToUser || null
        });

        question.comments.push(comment._id);
        await question.save();

        // Notifications
        if (parentCommentId && replyToUser && replyToUser.toString() !== req.user.id.toString()) {
            await Notification.create({
                recipient: replyToUser,
                sender: req.user.id,
                type: 'reply',
                post: id, // Note: This might cause issues if notification model only expects Post/Shorts. 
                // However, I'll update notification model to be more generic if needed.
                commentText: text
            });
        } else if (question.postedBy.toString() !== req.user.id.toString()) {
            await Notification.create({
                recipient: question.postedBy,
                sender: req.user.id,
                type: 'comment',
                post: id,
                commentText: text
            });
        }

        const populatedComment = await Comment.findById(comment._id)
            .populate("commentor", "name avatar username")
            .populate("replyToUser", "username");

        res.status(200).json({ success: true, comment: populatedComment });
    } catch (error) {
        console.error("Error in addComment:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getComments = async (req, res) => {
    try {
        const { id } = req.params;
        const commentsWithReplies = await getCommentThread(id, "PlacementQuestion");

        res.status(200).json({ success: true, comments: commentsWithReplies });
    } catch (error) {
        console.error("Error in getComments:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const getTrending = async (req, res) => {
    try {
        // Simple trending logic: count upvotes and comments
        const trending = await PlacementQuestion.aggregate([
            {
                $addFields: {
                    score: { $add: [{ $size: "$upvotes" }, { $size: "$comments" }] }
                }
            },
            { $sort: { score: -1, createdAt: -1 } },
            { $limit: 10 }
        ]);

        // Aggregate doesn't auto-populate, so we need to do it manually or use another query
        const populated = await PlacementQuestion.populate(trending, { path: "postedBy", select: "name avatar username" });
        res.status(200).json({ success: true, data: populated });
    } catch (error) {
        console.error("Error in getTrending:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const toggleSave = async (req, res) => {
    try {
        const { id } = req.params;
        const question = await PlacementQuestion.findById(id);
        if (!question) return res.status(404).json({ success: false, message: "Question not found" });

        const isSaved = (question.savedBy || []).some(id => String(id) === String(req.user.id));
        if (isSaved) {
            question.savedBy = question.savedBy.filter(uid => uid.toString() !== req.user.id);
        } else {
            question.savedBy.push(req.user.id);
        }

        await question.save();
        res.status(200).json({ success: true, isSaved: !isSaved });
    } catch (error) {
        console.error("Error in toggleSave:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
