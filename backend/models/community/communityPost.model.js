import mongoose from "mongoose";

// Reddit's hot ranking. Score moves the post logarithmically — the 10th upvote
// is worth as much as the next 90 — while age moves it linearly, so a new post
// with a few votes can outrank an old post with many. 45000 seconds ≈ 12.5h is
// Reddit's own constant: that is how long it takes one order of magnitude of
// votes to be cancelled out by age.
const HOT_EPOCH = new Date('2005-12-08T07:46:43Z').getTime();
const HOT_SECONDS_PER_ORDER = 45000;

export const hotScore = (score, createdAt) => {
    const sign = score > 0 ? 1 : score < 0 ? -1 : 0;
    const order = Math.log10(Math.max(Math.abs(score), 1));
    const seconds = (new Date(createdAt).getTime() - HOT_EPOCH) / 1000;
    return Number((sign * order + seconds / HOT_SECONDS_PER_ORDER).toFixed(7));
};

// The same formula as an aggregation-pipeline expression, so a vote recomputes
// the rank inside the one atomic write that changes the score. Keeping it in JS
// would mean read-modify-write, which is exactly how vote counters drift.
export const hotScoreStage = {
    $let: {
        vars: { s: { $ifNull: ['$score', 0] } },
        in: {
            $round: [{
                $add: [
                    {
                        $multiply: [
                            { $cond: [{ $gt: ['$$s', 0] }, 1, { $cond: [{ $lt: ['$$s', 0] }, -1, 0] }] },
                            { $log10: { $max: [{ $abs: '$$s' }, 1] } },
                        ]
                    },
                    {
                        $divide: [
                            { $divide: [{ $subtract: ['$createdAt', new Date(HOT_EPOCH)] }, 1000] },
                            HOT_SECONDS_PER_ORDER,
                        ]
                    },
                ]
            }, 7]
        }
    }
};

const communityPostSchema = new mongoose.Schema({
    subCommunityId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubCommunity', required: true },
    // Denormalised from the sub so membership and suspension checks, and any
    // hub-wide listing, do not need a join.
    communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    body: { type: String, default: '', maxlength: 20000 },
    image: { type: [String], default: [] },

    // Same shape as post.model.js, so the atomic vote pattern is identical.
    upvoted_by: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
    downvoted_by: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
    score: { type: Number, default: 0 },
    hotScore: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
}, { timestamps: true });

// One index per sort order. Without these, every feed load collection-scans the
// sub and sorts in memory.
communityPostSchema.index({ subCommunityId: 1, hotScore: -1 });   // hot
communityPostSchema.index({ subCommunityId: 1, createdAt: -1 });  // new
communityPostSchema.index({ subCommunityId: 1, score: -1 });      // top
communityPostSchema.index({ author: 1, createdAt: -1 });

const CommunityPost = mongoose.model('CommunityPost', communityPostSchema);
export default CommunityPost;
