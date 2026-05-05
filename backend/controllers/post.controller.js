import express from 'express';
import mongoose from 'mongoose';
import Post from '../models/post.model.js';
import Comment from '../models/comment.model.js';
import User from '../models/user.model.js';
import Notification from '../models/notification.model.js';
import Report from '../models/report.model.js';
import { sendPushNotification } from '../utils/notification.js';
import { deleteFromR2 } from '../utils/r2.js';
import { getCandidatePool, getUserInterestProfile, rankFeed, invalidatePool } from '../utils/feedEngine.js';
import { clearCache } from '../middlewares/cache.middleware.js';

import { updateStreak } from '../utils/streak.js';

export const createPost = async (req, res) => {
    try {
            const { description, mentions, isPrivate } = req.body;
        if (!description) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        else {
            console.log("📝 [CreatePost] Body:", req.body);
            console.log("📁 [CreatePost] Files:", req.files?.length || 0);
            
            const user = await User.findById(req.user.id);
            if (!user) {
                console.error("❌ [CreatePost] User Not Found in DB:", req.user.id);
                return res.status(400).json({ success: false, message: 'User not found' });
            }
            console.log("👤 [CreatePost] User Found:", { id: user._id, college: user.college, access: user.user_access });

            let image = [];
            if (req.files && req.files.length > 0) {
                image = req.files.map(file => file.path);
            }
            
            let parsedMentions = [];
            if (mentions) {
                try {
                    const rawMentions = typeof mentions === 'string' ? JSON.parse(mentions) : mentions;
                    if (Array.isArray(rawMentions)) {
                        // Filter out any invalid ObjectIds to prevent Mongoose CastError
                        parsedMentions = rawMentions.filter(id => mongoose.Types.ObjectId.isValid(id));
                    }
                } catch(e) {
                    parsedMentions = [];
                }
            }

            // Fallback for college if missing (since it's required in Post schema)
            const postCollege = user.college || req.user.college || "Fync Community";

            const post = await Post.create({
                description,
                image,
                user: req.user.id,
                college: postCollege,
                mentions: parsedMentions,
                isPrivate: isPrivate === 'true' || isPrivate === true,
                likes: 0,
                liked_by: [],
                comments: []
            })
            
            // Update Daily Streak
            const streakResult = await updateStreak(req.user.id).catch(err => {
                console.error("Streak error:", err);
                return { streakCount: null, isCompletedToday: false };
            });

            // Notify mentioned users - Wrap in try-catch so it doesn't crash the whole request
            try {
                if (parsedMentions && parsedMentions.length > 0) {
                    for (const mentionedUserId of parsedMentions) {
                        if (mentionedUserId.toString() !== req.user.id.toString()) {
                            await Notification.create({
                                recipient: mentionedUserId,
                                sender: req.user.id,
                                type: 'mention',
                                post: post._id,
                            });
                            
                            const mentionedUser = await User.findById(mentionedUserId);
                            if (mentionedUser && mentionedUser.expoPushToken) {
                                await sendPushNotification(
                                    mentionedUser.expoPushToken,
                                    "You were mentioned! 📣",
                                    `${user.username} tagged you in a new post.`,
                                    { url: `fync://view?postId=${post._id}` }
                                ).catch(err => console.error("Push Notification Error:", err));
                            }
                        }
                    }
                }
            } catch (notifyError) {
                console.error("❌ Notification Side-effect Error:", notifyError.message);
            }

            // Invalidate Cache - Wrap in try-catch
            try {
                invalidatePool('posts').catch(() => { });
                clearCache('feed').catch(() => { });
                clearCache('posts').catch(() => { });
            } catch (cacheError) {
                console.error("❌ Cache Invalidation Error:", cacheError.message);
            }

            return res.status(200).json({ 
                success: true, 
                message: 'Post created successfully', 
                post, 
                streakCount: streakResult.streakCount,
                isCompletedToday: streakResult.isCompletedToday
            });
        }
    } catch (error) {
        console.error("❌ CREATE POST ERROR:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Internal server error",
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}

export const getPosts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;

        const posts = await Post.find({ user: req.user.id })
            .populate("user", "name avatar username college user_access")
            .populate({
                path: "comments",
                populate: { path: "user", select: "name avatar username" }
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const totalPosts = await Post.countDocuments({ user: req.user.id });

        return res.status(200).json({ 
            success: true, 
            message: "Posts fetched successfully", 
            posts,
            hasMore: skip + posts.length < totalPosts
        });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const updatePost = async (req, res) => {
    try {
        const { description, isPrivate } = req.body;
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found" });
        }
        if (post.user.toString() !== req.user.id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        else {
            let image = [];
            if (req.files && req.files.length > 0) {
                image = req.files.map(file => file.path);
                // Since there are new images, delete old ones
                if (post.image && Array.isArray(post.image)) {
                    for (let imgUrl of post.image) {
                        await deleteFromR2(imgUrl);
                    }
                }
            }
            const updatedPost = await Post.findByIdAndUpdate(
                req.params.id,
                {
                    $set: {
                        ...(description && { description }),
                        ...(image.length > 0 && { image }),
                        ...(isPrivate !== undefined && { isPrivate: isPrivate === 'true' || isPrivate === true }),
                    },
                },
                { new: true, runValidators: true }
            ).populate("user");
            
            clearCache('feed').catch(() => { });
            clearCache('posts').catch(() => { });
            clearCache(`individual/${req.params.id}`).catch(() => { });
            invalidatePool('posts').catch(() => { });
            
            return res.status(200).json({ success: true, message: "Post updated successfully", post: updatedPost });
        }
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const deletePost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found" });
        }
        if (post.user.toString() !== req.user.id.toString()) {
            console.log("Delete Post Unauthorized:", {
                postUser: post.user.toString(),
                reqUser: req.user.id.toString(),
                match: post.user.toString() === req.user.id.toString()
            });
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        else {
            if (post.image && Array.isArray(post.image)) {
                for (let imgUrl of post.image) {
                    await deleteFromR2(imgUrl);
                }
            }
            // Also delete associated comments to keep DB clean
            await Comment.deleteMany({ post: req.params.id, postType: "Post" });

            const deletedPost = await Post.findByIdAndDelete(req.params.id);
            clearCache('feed').catch(() => { });
            clearCache('posts').catch(() => { });
            clearCache(`individual/${req.params.id}`).catch(() => { });
            return res.status(200).json({ success: true, message: "Post deleted successfully", post: deletedPost });
        }
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const likePost = async (req, res) => {
    try {
        const userId = req.user.id;
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found" });
        }
        const isLiked = post.liked_by.includes(userId);
        let updatedPost;
        if (isLiked) {
            updatedPost = await Post.findByIdAndUpdate(
                req.params.id,
                {
                    $inc: { likes: -1, score: -1 },
                    $pull: { liked_by: userId, upvoted_by: userId }
                },
                { new: true }
            );
            clearCache('posts').catch(() => { });
            clearCache(`individual/${req.params.id}`).catch(() => { });
            clearCache(`feed/${post.user}`).catch(() => { });
            invalidatePool('posts').catch(() => { });

            return res.status(200).json({ success: true, message: "Post unliked successfully", post: updatedPost });
        } else {
            updatedPost = await Post.findByIdAndUpdate(
                req.params.id,
                {
                    $inc: { likes: 1, score: 1 },
                    $addToSet: { liked_by: userId, upvoted_by: userId },
                    $pull: { downvoted_by: userId }
                },
                { new: true }
            );
            if (post.user.toString() !== req.user.id.toString()) {
                const existing = await Notification.findOne({
                    recipient: post.user,
                    sender: req.user.id,
                    type: 'like',
                    post: post._id
                });
                if (!existing) {
                    await Notification.create({
                        recipient: post.user,
                        sender: req.user.id,
                        type: 'like',
                        post: post._id
                    });
                }
            }
            clearCache('posts').catch(() => { });
            clearCache(`individual/${req.params.id}`).catch(() => { });
            clearCache(`feed/${post.user}`).catch(() => { });
            invalidatePool('posts').catch(() => { });

            return res.status(200).json({ success: true, message: "Post liked successfully", post: updatedPost });
        }
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const votePost = async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.body; // 'up', 'down', or null
        const userId = req.user.id;

        const post = await Post.findById(id);
        if (!post) return res.status(404).json({ success: false, message: "Post not found" });

        const isUpvoted = post.upvoted_by.some(uid => uid.toString() === userId);
        const isDownvoted = post.downvoted_by.some(uid => uid.toString() === userId);

        let updateQuery = { $set: {} };
        let scoreChange = 0;
        let likesChange = 0;

        // Case 1: Toggling UP vote
        if (type === 'up') {
            if (isUpvoted) {
                // Remove Upvote
                updateQuery.$pull = { upvoted_by: userId, liked_by: userId };
                scoreChange = -1;
                likesChange = -1;
            } else {
                // Add Upvote
                updateQuery.$addToSet = { upvoted_by: userId, liked_by: userId };
                scoreChange = isDownvoted ? 2 : 1;
                likesChange = 1;
                if (isDownvoted) updateQuery.$pull = { downvoted_by: userId };
                
                // Notification for upvote
                if (post.user.toString() !== userId) {
                    const existing = await Notification.findOne({
                        recipient: post.user,
                        sender: userId,
                        type: 'like',
                        post: post._id
                    });
                    if (!existing) {
                        await Notification.create({
                            recipient: post.user,
                            sender: userId,
                            type: 'like',
                            post: post._id
                        });
                    }
                }
            }
        } 
        // Case 2: Toggling DOWN vote
        else if (type === 'down') {
            if (isDownvoted) {
                // Remove Downvote
                updateQuery.$pull = { downvoted_by: userId };
                scoreChange = 1;
            } else {
                // Add Downvote
                updateQuery.$addToSet = { downvoted_by: userId };
                scoreChange = isUpvoted ? -2 : -1;
                if (isUpvoted) {
                    updateQuery.$pull = { upvoted_by: userId, liked_by: userId };
                    likesChange = -1;
                }
            }
        }
        // Case 3: Clear Vote (if type is null or something else)
        else {
            if (isUpvoted) {
                updateQuery.$pull = { upvoted_by: userId, liked_by: userId };
                scoreChange = -1;
                likesChange = -1;
            } else if (isDownvoted) {
                updateQuery.$pull = { downvoted_by: userId };
                scoreChange = 1;
            }
        }

        // Apply changes
        const updatedPost = await Post.findByIdAndUpdate(
            id,
            { 
                ...updateQuery, 
                $inc: { score: scoreChange, likes: likesChange } 
            },
            { new: true }
        ).populate("user", "name username avatar");

        // Cache invalidation
        clearCache('posts').catch(() => {});
        clearCache(`individual/${id}`).catch(() => {});
        invalidatePool('posts').catch(() => {});

        return res.status(200).json({ 
            success: true, 
            message: "Vote updated", 
            post: updatedPost 
        });
    } catch (error) {
        console.error("Vote Controller Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const addComment = async (req, res) => {
    try {
        const { text, parentCommentId } = req.body;
        if (!text) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ success: false, message: 'Post not found' });
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
            postType: "Post",
            parentComment: parentCommentId || null,
            replyToUser: replyToUser || null
        });

        // Notifications
        if (parentCommentId && replyToUser && replyToUser.toString() !== req.user.id) {
            await Notification.create({
                recipient: replyToUser,
                sender: req.user.id,
                type: 'reply',
                post: post._id,
                commentText: text
            });
        } else if (post.user.toString() !== req.user.id.toString()) {
            await Notification.create({
                recipient: post.user,
                sender: req.user.id,
                type: 'comment',
                post: post._id,
                commentText: text
            });
        }

        const commenterDetails = await Comment.findById(comment._id)
            .populate("commentor", "name avatar username")
            .populate("replyToUser", "username");

        clearCache(`comment/${req.params.id}`).catch(() => { });

        return res.status(200).json({ success: true, message: 'Comment created successfully', comment: commenterDetails });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const getComments = async (req, res) => {
    try {
        const comments = await Comment.find({ post: req.params.id, postType: "Post", parentComment: null })
            .populate("commentor", "name avatar username")
            .sort({ createdAt: -1 });

        // For each comment, fetch its replies
        const commentsWithReplies = await Promise.all(comments.map(async (comment) => {
            const replies = await Comment.find({ parentComment: comment._id })
                .populate("commentor", "name avatar username")
                .populate("replyToUser", "username")
                .sort({ createdAt: 1 });
            return { ...comment._doc, replies };
        }));

        return res.status(200).json({ 
            success: true, 
            message: 'Comments fetched successfully', 
            comments: commentsWithReplies, 
            commentLength: commentsWithReplies.length 
        });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const deleteComment = async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id);
        if (!comment) {
            return res.status(404).json({ success: false, message: 'Comment not found' });
        }
        if (comment.commentor.toString() !== req.user.id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        await Post.findByIdAndUpdate(comment.post, {
            $pull: { comments: comment._id }
        });
        const deletedComment = await Comment.findByIdAndDelete(req.params.id);
        return res.status(200).json({
            success: true,
            message: "Comment deleted successfully",
            deletedComment
        });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};


export const updateComment = async (req, res) => {
    try {
        const { text } = req.body;
        const comment = await Comment.findById(req.params.id);
        if (!comment) {
            return res.status(404).json({ success: false, message: 'Comment not found' });
        } 
        if (comment.commentor.toString() !== req.user.id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        else {
            const updatedComment = await Comment.findByIdAndUpdate(
                req.params.id,
                {
                    $set: {
                        ...(text && { text }),
                    },
                },
                { new: true, runValidators: true }
            ).populate("commentor");
            return res.status(200).json({ success: true, message: 'Comment updated successfully', comment: updatedComment });
        }
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getFeed = async (req, res) => {
    try {
        const { cursor, limit = 10 } = req.query;
        const query = cursor ? { _id: { $lt: cursor }, isPrivate: { $ne: true } } : { isPrivate: { $ne: true } };

        const posts = await Post.find(query)
            .sort({ _id: -1 })
            .limit(parseInt(limit))
            .populate("user", "name username avatar")
            .populate({
                path: "comments",
                populate: {
                    path: "commentor",
                    select: "name avatar username"
                }
            })
            .lean();

        const nextCursor = posts.length > 0 ? posts[posts.length - 1]._id : null;

        return res.status(200).json({ 
            success: true, 
            message: "Feed fetched successfully", 
            posts,
            nextCursor,
            hasMore: posts.length === parseInt(limit)
        });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getFollowingPosts = async (req, res) => {
    try {
        const loggedInUserId = req.user.id;
        const user = await User.findById(loggedInUserId).select("following");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const { cursor, limit = 10 } = req.query;
        const query = { 
            user: { $in: user.following }, 
            isPrivate: { $ne: true },
            ...(cursor && { _id: { $lt: cursor } })
        };
        const posts = await Post.find(query)
            .sort({ _id: -1 })
            .limit(parseInt(limit))
            .populate("user", "name username avatar")
            .lean();

        const nextCursor = posts.length > 0 ? posts[posts.length - 1]._id : null;

        res.status(200).json({ 
            success: true, 
            message: "Posts fetched successfully", 
            posts,
            nextCursor,
            hasMore: posts.length === parseInt(limit)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

export const getPostsByUserId = async (req, res) => {
    try {
        const { userId } = req.params;
        const { cursor, limit = 12 } = req.query;

        const query = { user: new mongoose.Types.ObjectId(userId) };
        if (req.user.id !== userId) {
            query.isPrivate = { $ne: true };
        }
        if (cursor) query._id = { $lt: cursor };

        const posts = await Post.find(query)
            .sort({ _id: -1 })
            .limit(parseInt(limit))
            .populate("user", "name username avatar")
            .lean();

        const nextCursor = posts.length > 0 ? posts[posts.length - 1]._id : null;

        return res.status(200).json({ 
            success: true, 
            posts,
            nextCursor,
            hasMore: posts.length === parseInt(limit) 
        });
    } catch (error) {
        console.log("Error fetching user posts:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getPostByPostId = async (req, res) => {
    try {
        const { postId } = req.params;
        if (!postId) {
            return res.status(400).json({ success: false, message: 'POST ID is required' });
        }
        const post = await Post.findById(postId)
            .populate("user", "name username avatar")
            .lean();
        if (!post) {
            return res.status(404).json({ success: false, message: 'Post not found' });
        }
        return res.status(200).json({ success: true, message: 'Post fetched successfully', post });
    } catch (error) {
        console.log("Error fetching post:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
}

// ─────────────────────────────────────────────────────────────
//  SMART FEED  (Gemini AI + Redis cache + in-memory ranking)
// ─────────────────────────────────────────────────────────────

/**
 * GET /post/smart-feed?page=1&limit=10
 * Body (optional): { seenIds: ["id1", "id2", ...] }
 *
 * How it works (zero extra DB load):
 *  1. Candidate pool is fetched from Redis (or DB once, then cached 5 min)
 *  2. User interest profile is fetched from Redis (or Gemini once per 24h)
 *  3. All scoring happens IN MEMORY — no additional DB queries
 *  4. seenIds come from the CLIENT (AsyncStorage) — no DB writes needed
 */
export const getSmartFeed = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const simpleFallback = async () => {
        const posts = await Post.find({ isPrivate: { $ne: true } })
            .populate('user', 'name username avatar user_access')
            .populate({ path: 'comments', populate: { path: 'commentor', select: 'name avatar username' } })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
        return res.status(200).json({ success: true, posts, hasMore: posts.length >= limit, mode: 'fallback' });
    };

    try {
        const seenIds = Array.isArray(req.body?.seenIds) ? req.body.seenIds : [];

        const [candidates, interestProfile] = await Promise.all([
            getCandidatePool(Post, 150),
            User.findById(req.user.id)
                .select('interest hobbies skills major about')
                .lean()
                .then(userDoc => getUserInterestProfile({
                    ...(userDoc || {}),
                    id: req.user.id,
                    _id: req.user.id
                }))
        ]);

        // STEP 3 — In-memory rank + paginate
        let ranked;
        try {
            ranked = rankFeed({ candidates, seenIds, interestProfile, page, limit });
        } catch (e) {
            console.error('[SmartFeed] Step3 rankFeed failed:', e.message);
            return simpleFallback();
        }

        return res.status(200).json({
            success: true,
            posts: ranked.items,
            hasMore: ranked.hasMore,
            mode: ranked.mode   // 'fresh' | 'recycled'
        });

    } catch (error) {
        console.error('[SmartFeed] Unexpected error:', error);
        return simpleFallback();
    }
};

export const reportPost = async (req, res) => {
    try {
        const { postId, reason } = req.body;
        const userId = req.user.id;

        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ success: false, message: "Post not found" });

        await Report.create({
            reporter: userId,
            post: postId,
            reason: reason || "Inappropriate content"
        });

        return res.status(200).json({ success: true, message: "Post reported successfully" });
    } catch (error) {
        console.error("Report Post Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getReports = async (req, res) => {
    try {
        if (req.user.user_access !== 'admin') {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        const reports = await Report.find({ status: 'pending' })
            .populate("reporter", "name username avatar")
            .populate({
                path: "post",
                populate: { path: "user", select: "name username avatar" }
            })
            .sort({ createdAt: -1 });

        return res.status(200).json({ success: true, reports });
    } catch (error) {
        console.error("Get Reports Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const adminDeletePost = async (req, res) => {
    try {
        if (req.user.user_access !== 'admin') {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        const { postId, reportId } = req.body;
        
        const post = await Post.findById(postId);
        if (post) {
            if (post.image && Array.isArray(post.image)) {
                for (let imgUrl of post.image) {
                    await deleteFromR2(imgUrl);
                }
            }
            await Comment.deleteMany({ post: postId });
            await Post.findByIdAndDelete(postId);
        }

        if (reportId) {
            await Report.findByIdAndUpdate(reportId, { status: 'resolved' });
        }

        invalidatePool('posts').catch(() => {});
        clearCache('feed').catch(() => {});

        return res.status(200).json({ success: true, message: "Post deleted by admin" });
    } catch (error) {
        console.error("Admin Delete Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
