import express from 'express';
import mongoose from 'mongoose';
import Shorts from '../models/shorts.model.js';
import Comment from '../models/comment.model.js';
import Notification from '../models/notification.model.js';
import User from '../models/user.model.js';
import { deleteFromCloudinary } from '../utils/cloudinary.js';
import { getShortsPool, getUserInterestProfile, rankFeed, invalidatePool } from '../utils/feedEngine.js';
import { clearCache } from '../middlewares/cache.middleware.js';

export const createShorts = async (req, res) => {
    try {
        const { title, description } = req.body;
        if (!title || !description) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        const createShort = await Shorts.create({
            video: req.file?.path || "",
            title,
            description,
            user: req.user.id,
            comments: [],
            likes: 0,
            liked_by: [],
            views: 0,
        })
        // Invalidate Redis shorts pool so next fetch picks this up
        invalidatePool('global', 'shorts').catch(() => { });
        clearCache('shorts').catch(() => { });
        return res.status(200).json({ success: true, message: 'Short created successfully', createShort });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const fetchShorts = async (req, res) => {
    try {
        const { page } = req.query;
        const limit = 15;
        const skip = (page - 1) * limit;
        const shorts = await Shorts.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("user", "name username avatar upiId user_access");

        const shortsWithCount = await Promise.all(
            shorts.map(async (s) => {
                const count = await Comment.countDocuments({
                    post: s._id,
                    postType: "Shorts",
                });
                return { ...s, commentsCount: count };
            })
        );
        return res.status(200).json({ success: true, message: "Shorts fetched successfully", shorts });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const getYourShorts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;

        const shorts = await Shorts.find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalShorts = await Shorts.countDocuments({ user: req.user.id });

        return res.status(200).json({ 
            success: true, 
            message: "Shorts fetched successfully", 
            shorts,
            hasMore: skip + shorts.length < totalShorts
        });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const updateShort = async (req, res) => {
    try {
        const short = await Shorts.findById(req.params.id);
        if (!short) {
            return res.status(404).json({ success: false, message: "Short not found" });
        }
        if (short.user.toString() !== req.user.id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        const updatedShort = await Shorts.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    ...(req.body.title && { title: req.body.title }),
                    ...(req.body.description && { description: req.body.description }),
                },
            },
            { new: true, runValidators: true }
        ).populate("user");
        return res.status(200).json({ success: true, message: "Short updated successfully", short: updatedShort });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const deleteShort = async (req, res) => {
    try {
        const short = await Shorts.findById(req.params.id);
        if (!short) {
            return res.status(404).json({ success: false, message: "Short not found" });
        }
        if (short.user.toString() !== req.user.id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        if (short.video) {
            await deleteFromCloudinary(short.video, "video");
        }
        await Comment.deleteMany({ post: req.params.id, postType: "Shorts" });
        const deletedShort = await Shorts.findByIdAndDelete(req.params.id);
        clearCache('shorts').catch(() => { });
        clearCache(`individual/${req.params.id}`).catch(() => { });
        return res.status(200).json({ success: true, message: "Short deleted successfully", short: deletedShort });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const likeAndUnlikeShort = async (req, res) => {
    try {
        const short = await Shorts.findById(req.params.id);
        if (!short) {
            return res.status(404).json({ success: false, message: "Short not found" });
        }
        const isLiked = short.liked_by.some(id => id.toString() === req.user.id.toString());
        let updatedShort;
        if (isLiked) {
            updatedShort = await Shorts.findByIdAndUpdate(
                req.params.id,
                {
                    $inc: { likes: -1 },
                    $pull: { liked_by: req.user.id }
                },
                { new: true }
            );
            clearCache('shorts').catch(() => { });
            clearCache(`individual/${req.params.id}`).catch(() => { });
            clearCache(`feed/${short.user}`).catch(() => { });
            invalidatePool('global', 'shorts').catch(() => { });

            return res.status(200).json({ success: true, message: "Short unliked successfully", short: updatedShort });
        }
        else {
            updatedShort = await Shorts.findByIdAndUpdate(
                req.params.id,
                {
                    $inc: { likes: 1 },
                    $addToSet: { liked_by: req.user.id }
                },
                { new: true }
            );
            if (short.user.toString() !== req.user.id.toString()) {
                const existing = await Notification.findOne({
                    recipient: short.user,
                    sender: req.user.id,
                    type: 'story_like',
                    shorts: short._id
                });
                if (!existing) {
                    await Notification.create({
                        recipient: short.user,
                        sender: req.user.id,
                        type: 'story_like',
                        shorts: short._id
                    });
                }
            }
            clearCache('shorts').catch(() => { });
            clearCache(`individual/${req.params.id}`).catch(() => { });
            clearCache(`feed/${short.user}`).catch(() => { });
            invalidatePool('global', 'shorts').catch(() => { });

            return res.status(200).json({ success: true, message: "Short liked successfully", short: updatedShort });
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
        const short = await Shorts.findById(req.params.id);
        if (!short) {
            return res.status(404).json({ success: false, message: "Short not found" });
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
            postType: "Shorts",
            parentComment: parentCommentId || null,
            replyToUser: replyToUser || null
        })

        // Notifications
        if (parentCommentId && replyToUser && replyToUser.toString() !== req.user.id) {
            await Notification.create({
                recipient: replyToUser,
                sender: req.user.id,
                type: 'story_reply',
                shorts: short._id,
                commentText: text
            });
        } else if (short.user.toString() !== req.user.id.toString()) {
            await Notification.create({
                recipient: short.user,
                sender: req.user.id,
                type: 'story_comment',
                shorts: short._id,
                commentText: text
            });
        }

        const commenterDetails = await Comment.findById(comment._id)
            .populate("commentor", "name avatar username")
            .populate("replyToUser", "username");

        clearCache(`comments/${req.params.id}`).catch(() => { });
        return res.status(200).json({ success: true, message: "Comment created successfully", comment: commenterDetails });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const getAllComments = async (req, res) => {
    try {
        const comments = await Comment.find({ post: req.params.id, postType: "Shorts", parentComment: null })
            .populate("commentor", "name avatar username")
            .sort({ createdAt: -1 });

        const commentsWithReplies = await Promise.all(comments.map(async (comment) => {
            const replies = await Comment.find({ parentComment: comment._id })
                .populate("commentor", "name avatar username")
                .populate("replyToUser", "username")
                .sort({ createdAt: 1 });
            return { ...comment._doc, replies };
        }));

        return res.status(200).json({ success: true, message: "Comments fetched successfully", comments: commentsWithReplies, totalComments: commentsWithReplies.length });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error", });
    }
};

export const updateComment = async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ success: false, message: "Text required" });
        }
        const comment = await Comment.findById(req.params.id);
        if (!comment) {
            return res.status(404).json({ success: false, message: "Comment not found" });
        }
        if (comment.commentor.toString() !== req.user.id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        comment.text = text;
        await comment.save();
        const updated = await Comment.findById(comment._id).populate(
            "commentor",
            "name avatar username"
        );
        return res.status(200).json({
            success: true,
            message: "Comment updated",
            comment: updated,
        });
    } catch (error) {
        console.log("Update comment error", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const deleteComment = async (req, res) => {
    try {
        const comment = await Comment.find({ post: req.params.id, postType: "Shorts" });
        if (!comment) {
            return res.status(404).json({ success: false, message: "Comment not found" });
        }
        if (comment.commentor.toString() !== req.user.id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        await Comment.findOneAndDelete({ post: req.params.id });
        return res.status(200).json({ success: true, message: "Comment deleted successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const viewsInShort = async (req, res) => {
    try {
        const short = await Shorts.findById(req.params.id);
        if (!short) {
            return res.status(404).json({ success: false, message: "Short not found" });
        }
        const views = short.views + 1;
        const updatedShort = await Shorts.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    ...(views && { views }),
                },
            },
            { new: true, runValidators: true }
        ).populate("user");
        return res.status(200).json({ success: true, message: "Short viewed successfully", short: updatedShort });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const getShortsByUserId = async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`🎥 [ShortsController] Fetching shorts for user: ${userId}`);
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;

        const query = { user: new mongoose.Types.ObjectId(userId) };
        const shorts = await Shorts.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        return res.status(200).json({ 
            success: true, 
            shorts,
            hasMore: shorts.length === limit
        });
    } catch (error) {
        console.log("Error fetching user shorts:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getShortByShortId = async (req, res) => {
    try {
        const { shortId } = req.params;
        const short = await Shorts.findById(shortId).populate("user", "name username avatar upiId");
        if (!short) {
            return res.status(404).json({ success: false, message: "Short not found" });
        }
        return res.status(200).json({ success: true, message: "Short fetched successfully", short });
    } catch (error) {
        console.log("Error fetching user shorts:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// ─────────────────────────────────────────────────────────────
//  SMART SHORTS  (Gemini AI + Redis cache + in-memory ranking)
// ─────────────────────────────────────────────────────────────

/**
 * GET /shorts/smart?page=1
 * Body (optional): { seenIds: ["id1", "id2", ...] }
 *
 * - Pulls from Redis-cached shorts pool (DB hit: once per 5 min globally)
 * - Ranks by user interest (Gemini, cached 24h) + engagement + recency
 * - Client supplies seenIds via AsyncStorage — zero DB writes
 */
export const getSmartShorts = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 15;
    const skip = (page - 1) * limit;

    // ── HARD FALLBACK ─────────────────────────────────────────
    const simpleFallback = async () => {
        const shorts = await Shorts.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('user', 'name username avatar upiId user_access');
        return res.status(200).json({ success: true, shorts, hasMore: shorts.length >= limit, mode: 'fallback' });
    };

    try {
        const seenIds = Array.isArray(req.body?.seenIds) ? req.body.seenIds : [];

        const [candidates, interestProfile] = await Promise.all([
            getShortsPool(Shorts, 100),
            User.findById(req.user.id)
                .select('interest hobbies skills major about')
                .lean()
                .then(userDoc => getUserInterestProfile({
                    ...(userDoc || {}),
                    id: req.user.id,
                    _id: req.user.id
                }))
        ]);

        // STEP 3 — Rank + paginate
        let ranked;
        try {
            ranked = rankFeed({ candidates, seenIds, interestProfile, page, limit });
        } catch (e) {
            console.error('[SmartShorts] Step3 rankFeed failed:', e.message);
            return simpleFallback();
        }

        return res.status(200).json({
            success: true,
            shorts: ranked.items,
            hasMore: ranked.hasMore,
            mode: ranked.mode
        });

    } catch (error) {
        console.error('[SmartShorts] Unexpected error:', error);
        return simpleFallback();
    }
};