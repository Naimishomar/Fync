import mongoose from "mongoose";

const commentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    text: {
        type: String,
        required: true
    }
}, { timestamps: true });

const placementQuestionSchema = new mongoose.Schema({
    company: {
        type: String,
        required: true,
        index: true
    },
    role: {
        type: String,
        required: true
    },
    round: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ["DSA", "HR", "System Design", "Aptitude", "Core Subject"],
        required: true
    },
    difficulty: {
        type: String,
        enum: ["Easy", "Medium", "Hard"],
        required: true
    },
    question: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    postedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    upvotes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    comments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment"
    }],
    savedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    reports: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        reason: String
    }]
}, { timestamps: true });

const PlacementQuestion = mongoose.model("PlacementQuestion", placementQuestionSchema);
export default PlacementQuestion;
