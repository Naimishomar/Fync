import express from 'express';
import Shorts from '../models/shorts.model.js';
import Comment from '../models/comment.model.js';
import Notification from '../models/notification.model.js';
import User from '../models/user.model.js';
import { deleteFromCloudinary } from '../utils/cloudinary.js';
import { getShortsPool, getUserInterestProfile, rankFeed, invalidatePool } from '../utils/feedEngine.js';

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
        return res.status(200).json({ success: true, message: 'Short created successfully', createShort });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const fetchShorts = async (req, res) => {
    try {
        const { page } = req.query;
        const limit = 10;
        const skip = (page - 1) * limit;
        const shorts = await Shorts.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("user", "name username avatar upiId");

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
        const shorts = await Shorts.find({ user: req.user.id });
        if (!shorts) {
            return res.status(404).json({ success: false, message: "Shorts not found" });
        }
        return res.status(200).json({ success: true, message: "Shorts fetched successfully", shorts });
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
        const isLiked = short.liked_by.includes(req.user.id);
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
            return res.status(200).json({ success: true, message: "Short liked successfully", short: updatedShort });
        }
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const addComment = async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }
        const short = await Shorts.findById(req.params.id);
        if (!short) {
            return res.status(404).json({ success: false, message: "Short not found" });
        }
        const comment = await Comment.create({
            text,
            commentor: req.user.id,
            post: req.params.id,
            postType: "Shorts"
        })
        const commenterDetails = await Comment.findById(comment._id).populate("commentor", "name avatar username");
        if (short.user.toString() !== req.user.id.toString()) {
            await Notification.create({
                recipient: short.user,
                sender: req.user.id,
                type: 'story_comment',
                shorts: short._id,
                commentText: text
            });
        }
        return res.status(200).json({ success: true, message: "Comment created successfully", comment, commenterDetails });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const getAllComments = async (req, res) => {
    try {
        const comments = await Comment.find({ post: req.params.id, postType: "Shorts" })
            .sort({ createdAt: -1 })
            .populate("commentor", "name avatar username");
        if (!comments) {
            return res.status(404).json({ success: false, message: "No comments" });
        }
        return res.status(200).json({ success: true, message: "Comments fetched successfully", comments, totalComments: comments.length });
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
        const shorts = await Shorts.find({ user: userId })
            .sort({ createdAt: -1 });
        return res.status(200).json({ success: true, shorts });
    } catch (error) {
        console.log("Error fetching user shorts:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getShortByShortId = async (req, res) => {
    try {
        const { shortId } = req.params;
        const short = await Shorts.findById(shortId).populate("user", "name username avatar upiId").populate("comments");
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
    const limit = 10;
    const skip = (page - 1) * limit;

    // ── HARD FALLBACK ─────────────────────────────────────────
    const simpleFallback = async () => {
        const shorts = await Shorts.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('user', 'name username avatar upiId');
        return res.status(200).json({ success: true, shorts, hasMore: shorts.length >= limit, mode: 'fallback' });
    };

    try {
        const seenIds = Array.isArray(req.body?.seenIds) ? req.body.seenIds : [];

        // STEP 1 — Shorts pool (Redis → MongoDB)
        let candidates;
        try {
            candidates = await getShortsPool(Shorts, 100);
        } catch (e) {
            console.error('[SmartShorts] Step1 getShortsPool failed:', e.message);
            return simpleFallback();
        }

        // STEP 2 — User interest profile (Gemini → Redis)
        let interestProfile = { keywords: [] };
        try {
            const userDoc = await User.findById(req.user.id)
                .select('interest hobbies skills major about')
                .lean();
            interestProfile = await getUserInterestProfile({
                ...(userDoc || {}),
                id: req.user.id,
                _id: req.user.id
            });
        } catch (e) {
            // Non-fatal — score by engagement only
            console.log('[SmartShorts] Step2 interest profile failed (using fallback):', e.message);
        }

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