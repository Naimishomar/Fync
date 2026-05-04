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
    index: true,
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
    index: true,
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
  liked_by:{
    type: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true,
      },
    ],
    default: [],
  },
  upvoted_by: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    default: [],
    index: true,
  },
  downvoted_by: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    default: [],
    index: true,
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

const Post = mongoose.model("Post", postSchema);
export default Post;