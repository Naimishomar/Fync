import mongoose from "mongoose";

const fundingProjectSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    image: {
        type: [String],
        required: false,
        default: []
    },
    video: {
        type: String,
        required: false,
        default: ""
    },
    deployed_url: {
        type: String,
        required: false
    },
    github_url: {
        type: String
    },
    likes: {
        type: Number,
        default: 0,
        required: true,
    },
    liked_by: {
        type: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                index: true,
            },
        ],
        default: [],
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
    paymentRefId: {
        type: String,
        required: false
    }
}, { timestamps: true });

// The feed is "everything, newest first"; "your projects" filters by owner.
// Neither had an index, so both scanned the collection and sorted in memory.
fundingProjectSchema.index({ createdAt: -1 });
fundingProjectSchema.index({ user: 1, createdAt: -1 });
const FundingProject = mongoose.model('FundingProject', fundingProjectSchema);
export default FundingProject;

