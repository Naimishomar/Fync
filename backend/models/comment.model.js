import mongoose from "mongoose";

const commentSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
  },
  commentor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'postType'
  },
  postType: {
    type: String,
    required: true,
    enum: ['Post', 'Shorts', 'FundingProject', 'Confession', 'Notice', 'Gaming', 'Outing', 'PlacementQuestion', 'JobOpening', 'FyncMedia', 'CommunityPost']
  },
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Comment",
    default: null
  },
  replyToUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  expiresAt: {
    type: Date,
    default: null,
  }
},{timestamps:true});

// Was: index({ createdAt: 1 }, { expiresAfterSeconds: 0 }).
// `expiresAfterSeconds` is a typo for `expireAfterSeconds`, so Mongo silently
// built a plain index and no TTL ever ran — and "fixing" the spelling in place
// would have deleted every comment the moment it was created. The TTL belongs on
// the `expiresAt` field, where documents with a null value are simply never
// reaped, which is the behaviour this schema was reaching for.
commentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Comment lists were collection-scanning: these cover the three read shapes used
// by post/funding/shorts controllers.
commentSchema.index({ post: 1, postType: 1, parentComment: 1, createdAt: -1 });
commentSchema.index({ parentComment: 1, createdAt: 1 });

const Comment = mongoose.model("Comment", commentSchema);
export default Comment;