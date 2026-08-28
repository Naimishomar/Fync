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
 * Attach each post's comment count and its newest top-level comment.
 *
 * Read from the comment collection rather than the `comments` array on the
 * post. That array is a denormalised copy that had drifted — it was $pull-ed on
 * delete but never pushed on create — so rows showed 0 comments until the sheet
 * was opened and answered with the truth. Counting where the comments actually
 * live cannot drift, and it is one indexed query per page either way.
 */
export const attachTopComments = async (posts, postType = "Post") => {
  if (!posts?.length) return posts ?? [];

  const ids = posts.map((post) => post._id);

  const [counts, newest] = await Promise.all([
    Comment.aggregate([
      { $match: { post: { $in: ids }, postType } },
      { $group: { _id: "$post", count: { $sum: 1 } } },
    ]),
    Comment.aggregate([
      // Replies belong under their parent, not in a one-line preview.
      { $match: { post: { $in: ids }, postType, parentComment: null } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$post", doc: { $first: "$$ROOT" } } },
    ]),
  ]);

  const topComments = newest.map((row) => row.doc);
  await Comment.populate(topComments, { path: "commentor", select: "name username avatar" });

  return mergeCommentMeta(posts, counts, topComments);
};

/**
 * The pure half of `attachTopComments`, kept separate so it can be tested
 * without a database.
 */
export function mergeCommentMeta(posts, counts, topComments) {
  const countByPost = new Map(counts.map((row) => [String(row._id), row.count]));
  const topByPost = new Map(topComments.map((comment) => [String(comment.post), comment]));

  return posts.map((post) => {
    const top = topByPost.get(String(post._id));
    return {
      ...post,
      commentCount: countByPost.get(String(post._id)) ?? 0,
      comments: top ? [top] : [],
    };
  });
}
