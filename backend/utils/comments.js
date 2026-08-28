import Comment from '../models/comment.model.js';

// Six controllers each hand-rolled the same thread fetch: one query for the
// top-level comments, then one more query *per comment* for its replies. A post
// with 200 comments cost 201 round-trips. This does it in two, regardless of
// thread size.
export const getCommentThread = async (postId, postType, { limit = 100 } = {}) => {
  const comments = await Comment.find({ post: postId, postType, parentComment: null })
    .populate('commentor', 'name avatar username')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  if (comments.length === 0) return [];

  const replies = await Comment.find({ parentComment: { $in: comments.map((c) => c._id) } })
    .populate('commentor', 'name avatar username')
    .populate('replyToUser', 'username')
    .sort({ createdAt: 1 })
    .lean();

  const repliesByParent = new Map();
  for (const reply of replies) {
    const key = String(reply.parentComment);
    const bucket = repliesByParent.get(key);
    if (bucket) bucket.push(reply);
    else repliesByParent.set(key, [reply]);
  }

  return comments.map((comment) => ({
    ...comment,
    replies: repliesByParent.get(String(comment._id)) || [],
  }));
};

/**
 * The feed shows one comment under each post, LinkedIn style.
 *
 * Every comment on 150 posts would be the largest thing in the cached pool and
 * the response, and the client renders exactly one of them — so the row keeps
 * the newest comment and a count, and the sheet fetches the rest on open.
 */
export function withTopComment(posts) {
    return posts.map((post) => {
        const comments = post.comments ?? [];
        const newest = [...comments]
            .sort((a, b) => new Date(a?.createdAt || 0) - new Date(b?.createdAt || 0))
            .slice(-1);
        return { ...post, commentCount: comments.length, comments: newest };
    });
}
