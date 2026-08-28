import mongoose from 'mongoose';

const shortsSchema = new mongoose.Schema({
    video: {
        type: String,
        required: true
    },

    /**
     * Poster frame, generated on the device at upload time.
     *
     * Grids used to mount a real <Video> per cell just to show a still, which
     * meant a dozen hardware decoders on one screen. This is the still.
     * Optional: shorts uploaded before this field existed have none, and the
     * client falls back to the video for those.
     */
    thumbnail: {
        type: String,
    },
    title:{
        type: String,
        required: true
    },
    description:{
        type: String,
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
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    comments: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Comment",
        },
    ],
    views: {
        type: Number,
        default: 0,
        required: true,
    },
}, {timestamps: true});

shortsSchema.index({ user: 1, _id: -1 });
shortsSchema.index({ views: -1 });
shortsSchema.index({ likes: -1 });
shortsSchema.index({ createdAt: -1 });

shortsSchema.index({ repostedBy: 1, createdAt: -1 });

const Shorts = mongoose.model('Shorts', shortsSchema);
export default Shorts;