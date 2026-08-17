import mongoose from "mongoose";

const postSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
  },
  image: {
    type: [String],
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    // No standalone index: the { user: 1, _id: -1 } compound below already
    // serves any query filtering on user alone.
  },
  mentions: {
    type: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    default: [],
  },
  college:{
    type: String,
    required: true,
    // Covered by the { college: 1, _id: -1 } compound below.
  },
  isPrivate: {
    type: Boolean,
    default: false,
  },
  likes: {
    type: Number,
    default: 0,
    required: true,
  },
  // No indexes on the vote arrays: nothing ever queries by them, and multikey
  // indexes here made every like/vote pay three extra index writes.
  liked_by:{
    type: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    default: [],
  },
  upvoted_by: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    default: [],
  },
  downvoted_by: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    default: [],
  },
  score: {
    type: Number,
    default: 0,
  },
  comments: {
    type: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment",
      },
    ],
    default: [],
  },
},{timestamps:true});

postSchema.index({ user: 1, _id: -1 });
postSchema.index({ college: 1, _id: -1 });
// getSmartFeed's fallback and the feed engine's candidate pool both sort by
// createdAt with no cursor; without this they collection-scan and sort in memory.
postSchema.index({ createdAt: -1 });

const Post = mongoose.model("Post", postSchema);
export default Post;