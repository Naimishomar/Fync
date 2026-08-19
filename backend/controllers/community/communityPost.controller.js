import mongoose from 'mongoose';
import Community from '../../models/community/community.model.js';
import SubCommunity from '../../models/community/subCommunity.model.js';
import CommunityPost, { hotScore, hotScoreStage } from '../../models/community/communityPost.model.js';
import Comment from '../../models/comment.model.js';
import Notification from '../../models/notification.model.js';
import { getCommentThread } from '../../utils/comments.js';

const hasId = (arr, id) => Array.isArray(arr) && id != null && arr.some((x) => String(x) === String(id));

const AUTHOR_FIELDS = 'name username avatar';

const SORTS = {
    hot: { hotScore: -1, _id: -1 },
    new: { createdAt: -1, _id: -1 },
    top: { score: -1, _id: -1 },
};

/**
 * The three write paths (post, vote, comment) share one gate: the room must be a
 * feed, the hub must not be suspended, and the caller must have joined. Written
 * once so a future fourth endpoint cannot forget one of the three.
 * @returns {{error: {status: number, message: string}} | {sub: object, isCreator: boolean}}
 */
const gateFeedWrite = async (subId, userId) => {
    if (!mongoose.isValidObjectId(subId)) return { error: { status: 400, message: "Invalid room" } };

    const sub = await SubCommunity.findById(subId).populate('communityId').lean();
    if (!sub) return { error: { status: 404, message: "Room not found" } };
    if (sub.type !== 'feed') return { error: { status: 400, message: "This room is not a feed" } };
    if (!sub.communityId) return { error: { status: 404, message: "Hub not found" } };
    if (sub.communityId.subscription?.status === 'suspended') {
        return { error: { status: 403, message: "Hub is suspended. Renew activation to post." } };
    }

    const isCreator = String(sub.communityId.creator) === String(userId);
    if (!isCreator && !hasId(sub.communityId.members, userId)) {
        return { error: { status: 403, message: "Join the hub to post" } };
    }
    return { sub, isCreator };
};

// ── Feed ─────────────────────────────────────────────────────────────────────

export const getFeed = async (req, res) => {
    try {
        const { subId } = req.params;
        const { sort = 'hot', cursor, limit } = req.query;
        const userId = req.user.id;

        if (!mongoose.isValidObjectId(subId)) {
            return res.status(400).json({ success: false, message: "Invalid room" });
        }

        const sub = await SubCommunity.findById(subId).populate('communityId', 'creator members subscription name').lean();
        if (!sub) return res.status(404).json({ success: false, message: "Room not found" });
        if (sub.communityId?.subscription?.status === 'suspended') {
            return res.status(403).json({ success: false, message: "Hub access suspended. Await Spark renewal." });
        }

        const sortOrder = SORTS[sort] || SORTS.hot;
        const pageSize = Math.min(Number(limit) || 20, 50);

        // Keyset pagination on the same key the sort uses, so page 20 costs the
        // same as page 1. `skip` would re-walk every earlier document.
        const query = { subCommunityId: subId };
        if (cursor) {
            const [sortValue, lastId] = String(cursor).split('_');
            const field = Object.keys(sortOrder)[0];
            const parsed = field === 'createdAt' ? new Date(sortValue) : Number(sortValue);
            if (!Number.isNaN(Number(parsed)) && mongoose.isValidObjectId(lastId)) {
                query.$or = [
                    { [field]: { $lt: parsed } },
                    { [field]: parsed, _id: { $lt: new mongoose.Types.ObjectId(lastId) } },
                ];
            }
        }

        const posts = await CommunityPost.find(query)
            .populate('author', AUTHOR_FIELDS)
            .sort(sortOrder)
            .limit(pageSize)
            .lean();

        // The vote arrays are the one thing a client must never see in full —
        // they are the membership list of who voted which way.
        const shaped = posts.map(({ upvoted_by, downvoted_by, ...post }) => ({
            ...post,
            myVote: hasId(upvoted_by, userId) ? 1 : hasId(downvoted_by, userId) ? -1 : 0,
        }));

        const last = posts[posts.length - 1];
        const field = Object.keys(sortOrder)[0];
        const nextCursor = posts.length === pageSize && last
            ? `${field === 'createdAt' ? new Date(last[field]).toISOString() : last[field]}_${last._id}`
            : null;

        return res.status(200).json({ success: true, sub, posts: shaped, nextCursor });
    } catch (error) {
        console.error("Community feed error:", error);
        return res.status(500).json({ success: false, message: "Error loading feed" });
    }
};

export const createPost = async (req, res) => {
    try {
        const { subCommunityId, title, body } = req.body;
        const userId = req.user.id;

        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: "A title is required" });
        }

        const gate = await gateFeedWrite(subCommunityId, userId);
        if (gate.error) return res.status(gate.error.status).json({ success: false, message: gate.error.message });

        const createdAt = new Date();
        const post = await CommunityPost.create({
            subCommunityId,
            communityId: gate.sub.communityId._id,
            author: userId,
            title: title.trim(),
            body: (body || '').trim(),
            // multer.array + r2UploadMiddleware leave the R2 URL on each file's `path`.
            image: (Array.isArray(req.files) ? req.files : []).map((f) => f.path).filter(Boolean),
            createdAt,
            // A brand-new post has score 0, so its rank is pure recency — the same
            // value the vote pipeline would compute.
            hotScore: hotScore(0, createdAt),
        });

        const populated = await post.populate('author', AUTHOR_FIELDS);
        const { upvoted_by, downvoted_by, ...clean } = populated.toObject();
        return res.status(201).json({ success: true, post: { ...clean, myVote: 0 } });
    } catch (error) {
        console.error("Create community post error:", error);
        return res.status(500).json({ success: false, message: "Error creating post" });
    }
};

export const getPost = async (req, res) => {
    try {
        const { postId } = req.params;
        if (!mongoose.isValidObjectId(postId)) {
            return res.status(400).json({ success: false, message: "Invalid post" });
        }

        const post = await CommunityPost.findById(postId)
            .populate('author', AUTHOR_FIELDS)
            .populate('subCommunityId', 'name type communityId')
            .lean();
        if (!post) return res.status(404).json({ success: false, message: "Post not found" });

        const comments = await getCommentThread(postId, 'CommunityPost');
        const { upvoted_by, downvoted_by, ...clean } = post;

        return res.status(200).json({
            success: true,
            post: { ...clean, myVote: hasId(upvoted_by, req.user.id) ? 1 : hasId(downvoted_by, req.user.id) ? -1 : 0 },
            comments,
        });
    } catch (error) {
        console.error("Get community post error:", error);
        return res.status(500).json({ success: false, message: "Error loading post" });
    }
};

export const deletePost = async (req, res) => {
    try {
        const { postId } = req.params;
        if (!mongoose.isValidObjectId(postId)) {
            return res.status(400).json({ success: false, message: "Invalid post" });
        }

        const post = await CommunityPost.findById(postId).lean();
        if (!post) return res.status(404).json({ success: false, message: "Post not found" });

        const community = await Community.findById(post.communityId).select('creator').lean();
        const isAuthor = String(post.author) === String(req.user.id);
        const isHubOwner = String(community?.creator) === String(req.user.id);
        if (!isAuthor && !isHubOwner) {
            return res.status(403).json({ success: false, message: "Not your post" });
        }

        // Orphaned comment threads would otherwise sit in the shared Comment
        // collection forever — nothing else reaps them.
        await Promise.all([
            CommunityPost.deleteOne({ _id: postId }),
            Comment.deleteMany({ post: postId, postType: 'CommunityPost' }),
        ]);
        return res.status(200).json({ success: true, message: "Post deleted" });
    } catch (error) {
        console.error("Delete community post error:", error);
        return res.status(500).json({ success: false, message: "Error deleting post" });
    }
};

// ── Voting ───────────────────────────────────────────────────────────────────

// One endpoint for both directions, and re-sending the same direction clears the
// vote — the way an arrow behaves on Reddit.
export const votePost = async (req, res) => {
    try {
        const { postId } = req.params;
        const dir = Number(req.body.dir);
        if (![1, -1, 0].includes(dir)) {
            return res.status(400).json({ success: false, message: "dir must be 1, -1 or 0" });
        }
        if (!mongoose.isValidObjectId(postId)) {
            return res.status(400).json({ success: false, message: "Invalid post" });
        }

        const existing = await CommunityPost.findById(postId).select('subCommunityId upvoted_by downvoted_by').lean();
        if (!existing) return res.status(404).json({ success: false, message: "Post not found" });

        const gate = await gateFeedWrite(existing.subCommunityId, req.user.id);
        if (gate.error) return res.status(gate.error.status).json({ success: false, message: gate.error.message });

        const uid = new mongoose.Types.ObjectId(String(req.user.id));
        const already = hasId(existing.upvoted_by, uid) ? 1 : hasId(existing.downvoted_by, uid) ? -1 : 0;
        const target = dir === already ? 0 : dir;   // clicking the same arrow twice un-votes

        const arr = (f) => ({ $ifNull: [`$${f}`, []] });
        const without = (f) => ({ $filter: { input: arr(f), cond: { $ne: ['$$this', uid] } } });

        // Everything is derived from the arrays inside one pipeline: the score
        // cannot drift from the votes, and the rank cannot drift from the score.
        // A double-tap or a retried request lands on the same final state.
        const updated = await CommunityPost.findByIdAndUpdate(
            postId,
            [
                {
                    $set: {
                        upvoted_by: target === 1 ? { $setUnion: [arr('upvoted_by'), [uid]] } : without('upvoted_by'),
                        downvoted_by: target === -1 ? { $setUnion: [arr('downvoted_by'), [uid]] } : without('downvoted_by'),
                    }
                },
                { $set: { score: { $subtract: [{ $size: '$upvoted_by' }, { $size: '$downvoted_by' }] } } },
                { $set: { hotScore: hotScoreStage } },
            ],
            { new: true, projection: { upvoted_by: 0, downvoted_by: 0 } }
        ).lean();

        return res.status(200).json({ success: true, post: { ...updated, myVote: target } });
    } catch (error) {
        console.error("Vote community post error:", error);
        return res.status(500).json({ success: false, message: "Error voting" });
    }
};

// ── Comments ─────────────────────────────────────────────────────────────────

export const addComment = async (req, res) => {
    try {
        const { postId } = req.params;
        const { text, parentComment, replyToUserId } = req.body;
        const userId = req.user.id;

        if (!text || !text.trim()) {
            return res.status(400).json({ success: false, message: "Comment cannot be empty" });
        }
        if (!mongoose.isValidObjectId(postId)) {
            return res.status(400).json({ success: false, message: "Invalid post" });
        }

        const post = await CommunityPost.findById(postId).select('subCommunityId author').lean();
        if (!post) return res.status(404).json({ success: false, message: "Post not found" });

        const gate = await gateFeedWrite(post.subCommunityId, userId);
        if (gate.error) return res.status(gate.error.status).json({ success: false, message: gate.error.message });

        let replyToUser = null;
        if (parentComment) {
            if (!mongoose.isValidObjectId(parentComment)) {
                return res.status(400).json({ success: false, message: "Invalid parent comment" });
            }
            const parent = await Comment.findById(parentComment).select('commentor post parentComment').lean();
            // Without this, a crafted parentComment id would graft a reply from
            // one post's thread onto another.
            if (!parent || String(parent.post) !== String(postId)) {
                return res.status(400).json({ success: false, message: "Parent comment is not on this post" });
            }
            // getCommentThread returns two levels, so replies always hang off a
            // top-level comment. Replying to a sibling reply therefore attaches
            // here but should still @-mention the person actually replied to.
            if (parent.parentComment) {
                return res.status(400).json({ success: false, message: "Reply to the top-level comment instead" });
            }
            replyToUser = parent.commentor;

            if (replyToUserId) {
                if (!mongoose.isValidObjectId(replyToUserId)) {
                    return res.status(400).json({ success: false, message: "Invalid mention" });
                }
                // Only someone who actually commented in this thread can be
                // mentioned, so the field cannot be used to ping arbitrary users.
                const inThread = await Comment.exists({
                    post: postId, postType: 'CommunityPost', commentor: replyToUserId,
                });
                if (!inThread) {
                    return res.status(400).json({ success: false, message: "That user has not commented here" });
                }
                replyToUser = replyToUserId;
            }
        }

        const comment = await Comment.create({
            text: text.trim(),
            commentor: userId,
            post: postId,
            postType: 'CommunityPost',
            parentComment: parentComment || null,
            replyToUser,
        });

        await CommunityPost.updateOne({ _id: postId }, { $inc: { commentCount: 1 } });

        const notify = replyToUser || post.author;
        if (String(notify) !== String(userId)) {
            await Notification.create({
                recipient: notify,
                sender: userId,
                type: parentComment ? 'reply' : 'comment',
                commentText: text.trim().substring(0, 50),
            });
        }

        const populated = await comment.populate('commentor', AUTHOR_FIELDS);
        return res.status(201).json({ success: true, comment: populated });
    } catch (error) {
        console.error("Add community comment error:", error);
        return res.status(500).json({ success: false, message: "Error adding comment" });
    }
};

export const deleteComment = async (req, res) => {
    try {
        const { commentId } = req.params;
        if (!mongoose.isValidObjectId(commentId)) {
            return res.status(400).json({ success: false, message: "Invalid comment" });
        }

        const comment = await Comment.findOne({ _id: commentId, postType: 'CommunityPost' }).lean();
        if (!comment) return res.status(404).json({ success: false, message: "Comment not found" });
        if (String(comment.commentor) !== String(req.user.id)) {
            return res.status(403).json({ success: false, message: "Not your comment" });
        }

        const replies = await Comment.countDocuments({ parentComment: commentId });
        await Comment.deleteMany({ $or: [{ _id: commentId }, { parentComment: commentId }] });
        await CommunityPost.updateOne(
            { _id: comment.post },
            [{ $set: { commentCount: { $max: [0, { $subtract: ['$commentCount', replies + 1] }] } } }]
        );

        return res.status(200).json({ success: true, message: "Comment deleted" });
    } catch (error) {
        console.error("Delete community comment error:", error);
        return res.status(500).json({ success: false, message: "Error deleting comment" });
    }
};
