import Confession from '../../models/newFeatures/confession.model.js';
import Comment from '../../models/comment.model.js';
import Notification from '../../models/notification.model.js';

import User from '../../models/user.model.js';
import { clearCacheTags } from '../../middlewares/cache.middleware.js';
import { getCommentThread } from "../../utils/comments.js";
import { toggleLike } from "../../utils/likeToggle.js";

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

        clearCacheTags(['confessions']).catch(() => { });
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
            .limit(limit)
            .lean();

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
        const result = await toggleLike(Confession, req.params.id, req.user.id);
        if (!result) return res.status(404).json({ success: false, message: "Confession not found" });

        const populatedConfession = await Confession.findById(result.doc._id)
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

        clearCacheTags(['confessions', `confession:${confessionId}`]).catch(() => { });
        return res.status(201).json({ success: true, comment: populatedComment });
    } catch (error) {
        console.error("Add confession comment error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getConfessionComments = async (req, res) => {
    try {
        const commentsWithReplies = await getCommentThread(req.params.id, "Confession");

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

        clearCacheTags(['confessions']).catch(() => { });
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

        clearCacheTags(['confessions', `confession:${id}`]).catch(() => { });
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
