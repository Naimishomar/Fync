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
  /**
   * People tagged in this post, each with their own consent state.
   *
   * Separate from `mentions`, which is just @-names inside the text. A tag puts
   * the post on someone else's profile, so it needs their agreement — nobody
   * should be able to attach a stranger's face or name to their own post
   * without being asked.
   */
  tags: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      status: { type: String, enum: ["pending", "accepted", "declined"], default: "pending" },
      respondedAt: { type: Date, default: null },
    },
  ],

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
  /**
   * Where the post was made, as a place name rather than coordinates.
   *
   * "CS Block" or "Main Gate" is what a student actually wants to read. A
   * latitude and longitude would reverse-geocode to the campus postcode, which
   * tells nobody anything and carries a privacy cost for no benefit.
   */
  location: {
    type: String,
    trim: true,
    maxlength: 80,
    default: null,
  },

  isPrivate: {
    type: Boolean,
    default: false,
  },

  /**
   * Reposts, held as a reference rather than a copy.
   *
   * A repost surfaces the original in someone else's feed; it does not
   * duplicate it. That way an edit or a delete by the author propagates
   * everywhere it was shared, and the credit stays with whoever wrote it.
   */
  reposts: {
    type: Number,
    default: 0,
  },
  repostedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  }],
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

// The two queries tagging creates: "tags awaiting my response" and "posts that
// appear on my profile".
postSchema.index({ "tags.user": 1, "tags.status": 1, createdAt: -1 });

postSchema.index({ repostedBy: 1, createdAt: -1 });

// The candidate pool is find({ isPrivate: { $ne: true } }).sort({ createdAt: -1 }).
// { createdAt: -1 } alone gives the sort but still fetches and discards private
// posts one by one; leading with isPrivate keeps the scan inside the index.
postSchema.index({ isPrivate: 1, createdAt: -1 });

const Post = mongoose.model("Post", postSchema);
export default Post;