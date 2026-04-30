import Confession from '../../models/newFeatures/confession.model.js';
import Comment from '../../models/comment.model.js';
import Notification from '../../models/notification.model.js';

import User from '../../models/user.model.js';
import { clearCache } from '../../middlewares/cache.middleware.js';

// Fixed color for all confessions as per requirement
const FIXED_CONFESSION_COLOR = '#FFFFFF';

export const createConfession = async (req, res) => {
    try {
        const { content, taggedUserId } = req.body;
        const college = req.user.college;
        const userId = req.user.id;

        if (!content) {
            return res.status(400).json({ success: false, message: 'Content is required' });
        }

        const confession = await Confession.create({
            content,
            user: userId,
            college,
            color: FIXED_CONFESSION_COLOR,
            taggedUser: taggedUserId || null,
        });

        if (taggedUserId) {
            await Notification.create({
                recipient: taggedUserId,
                sender: userId,
                type: 'tag',
                confession: confession._id,
                commentText: content.substring(0, 50) // Preview
            });
        }

        const populatedConfessions = await Confession.findById(confession._id)
            .populate('user', 'name gender')
            .populate('taggedUser', 'name username avatar user_access');

        const confessionWithFlag = {
            ...populatedConfessions._doc,
            canManage: true // Author can always manage their new post
        };

        clearCache('confessions').catch(() => { });
        return res.status(201).json({ success: true, message: 'Confession posted!', confession: confessionWithFlag });
    } catch (error) {
        console.error("Create confession error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getConfessions = async (req, res) => {
    try {
        const college = req.user.college;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const skip = (page - 1) * limit;

        const confessions = await Confession.find({ college })
            .populate('user', 'name gender')
            .populate('taggedUser', 'name username avatar user_access')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const confessionsWithFlags = confessions.map(c => ({
            ...c._doc,
            canManage: c.user?._id?.toString() === req.user.id.toString() || c.user?.toString() === req.user.id.toString()
        }));

        return res.status(200).json({ success: true, confessions: confessionsWithFlags, hasMore: confessions.length === limit });
    } catch (error) {
        console.error("Get confessions error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const likeConfession = async (req, res) => {
    try {
        const userId = req.user.id;
        const confession = await Confession.findById(req.params.id);

        if (!confession) {
            return res.status(404).json({ success: false, message: "Confession not found" });
        }

        const isLiked = confession.liked_by.includes(userId);
        let updatedConfession;

        if (isLiked) {
            updatedConfession = await Confession.findByIdAndUpdate(
                req.params.id,
                { $inc: { likes: -1 }, $pull: { liked_by: userId } },
                { new: true }
            );
        } else {
            updatedConfession = await Confession.findByIdAndUpdate(
                req.params.id,
                { $inc: { likes: 1 }, $addToSet: { liked_by: userId } },
                { new: true }
            );
        }

        const populatedConfession = await Confession.findById(updatedConfession._id)
            .populate('user', 'name gender')
            .populate('taggedUser', 'name username avatar user_access');

        return res.status(200).json({ success: true, confession: populatedConfession });
    } catch (error) {
        console.error("Like confession error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const addConfessionComment = async (req, res) => {
    try {
        const { text, parentCommentId } = req.body;
        const confessionId = req.params.id;
        const userId = req.user.id;

        if (!text) {
            return res.status(400).json({ success: false, message: 'Comment text is required' });
        }

        const confession = await Confession.findById(confessionId);
        if (!confession) {
             return res.status(404).json({ success: false, message: 'Confession not found' });
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
            commentor: userId,
            post: confessionId,
            postType: "Confession",
            parentComment: parentCommentId || null,
            replyToUser: replyToUser || null,
        });

        await Confession.findByIdAndUpdate(confessionId, { $push: { comments: comment._id } });

        const populatedComment = await Comment.findById(comment._id)
            .populate("commentor", "name username avatar")
            .populate("replyToUser", "username");

        clearCache(`confession_comments/${confessionId}`).catch(() => { });
        return res.status(201).json({ success: true, comment: populatedComment });
    } catch (error) {
        console.error("Add confession comment error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getConfessionComments = async (req, res) => {
    try {
        const comments = await Comment.find({ post: req.params.id, postType: "Confession", parentComment: null })
            .populate("commentor", "name username avatar")
            .sort({ createdAt: -1 });

        // Replies
        const commentsWithReplies = await Promise.all(comments.map(async (comment) => {
            const replies = await Comment.find({ parentComment: comment._id })
                .populate("commentor", "name username avatar")
                .populate("replyToUser", "username")
                .sort({ createdAt: 1 });
            return { ...comment._doc, replies };
        }));

        return res.status(200).json({ success: true, comments: commentsWithReplies });
    } catch (error) {
        console.error("Get confession comments error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const updateConfession = async (req, res) => {
    try {
        const { id } = req.params;
        const { content, taggedUserId } = req.body;
        const confession = await Confession.findById(id);

        if (!confession) {
            return res.status(404).json({ success: false, message: "Confession not found" });
        }

        // Only Owner can edit (Admins can only delete, as per user requirement)
        if (confession.user.toString() !== req.user.id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized to edit this confession" });
        }

        const updated = await Confession.findByIdAndUpdate(
            id,
            { 
                $set: { 
                    ...(content && { content }), 
                    color: FIXED_CONFESSION_COLOR,
                    taggedUser: taggedUserId !== undefined ? taggedUserId : confession.taggedUser 
                } 
            },
            { new: true }
        ).populate('user', 'name gender').populate('taggedUser', 'name username avatar user_access');

        const updatedWithFlag = {
            ...updated._doc,
            canManage: true
        };

        clearCache('confessions').catch(() => { });
        return res.status(200).json({ success: true, message: "Confession updated", confession: updatedWithFlag });
    } catch (error) {
        console.error("Update confession error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const deleteConfession = async (req, res) => {
    try {
        const { id } = req.params;
        const confession = await Confession.findById(id);

        if (!confession) {
            return res.status(404).json({ success: false, message: "Confession not found" });
        }

        // Admin or Owner
        if (confession.user.toString() !== req.user.id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }

        // Delete associated comments
        await Comment.deleteMany({ post: id, postType: "Confession" });
        await Confession.findByIdAndDelete(id);

        clearCache('confessions').catch(() => { });
        clearCache(`confession_comments/${id}`).catch(() => { });
        return res.status(200).json({ success: true, message: "Confession deleted" });
    } catch (error) {
        console.error("Delete confession error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const searchUsersForTag = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.json({ success: true, users: [] });

        const users = await User.find({
            college: req.user.college,
            user_access: { $ne: 'alumni' },
            $or: [
                { username: { $regex: query, $options: 'i' } },
                { name: { $regex: query, $options: 'i' } }
            ]
        })
        .select('name username avatar user_access')
        .limit(10);

        return res.status(200).json({ success: true, users });
    } catch (error) {
        console.error("Search users error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
