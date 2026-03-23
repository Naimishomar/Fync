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
    enum: ['Post', 'Shorts', 'FundingProject', 'Confession', 'Notice', 'Gaming', 'Outing', 'PlacementQuestion', 'JobOpening']
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

commentSchema.index({ createdAt: 1 }, {expiresAfterSeconds: 0});

const Comment = mongoose.model("Comment", commentSchema);
export default Comment;