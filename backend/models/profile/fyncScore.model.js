import mongoose from "mongoose";

const fyncScoreSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
        index: true
    },
    totalScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 1000
    },
    badge: {
        type: String,
        enum: ['Newcomer', 'Explorer', 'Builder', 'Innovator', 'Pioneer', 'Legend'],
        default: 'Newcomer'
    },
    // Score breakdown per category (max per category defined in score engine)
    breakdown: {
        hackathon: {
            score: { type: Number, default: 0 },
            maxScore: { type: Number, default: 200 },
            // Sub-details
            participated: { type: Number, default: 0 },
            won: { type: Number, default: 0 },
            submitted: { type: Number, default: 0 }
        },
        coding: {
            score: { type: Number, default: 0 },
            maxScore: { type: Number, default: 200 },
            leetcodeSolved: { type: Number, default: 0 },
            gfgSolved: { type: Number, default: 0 },
            oneVsOneWins: { type: Number, default: 0 }
        },
        github: {
            score: { type: Number, default: 0 },
            maxScore: { type: Number, default: 150 },
            totalCommits: { type: Number, default: 0 },
            totalRepos: { type: Number, default: 0 },
            totalStars: { type: Number, default: 0 },
            streak: { type: Number, default: 0 }
        },
        projects: {
            score: { type: Number, default: 0 },
            maxScore: { type: Number, default: 150 },
            count: { type: Number, default: 0 },
            totalLikes: { type: Number, default: 0 }
        },
        events: {
            score: { type: Number, default: 0 },
            maxScore: { type: Number, default: 100 },
            attended: { type: Number, default: 0 },
            asSpeaker: { type: Number, default: 0 }
        },
        internship: {
            score: { type: Number, default: 0 },
            maxScore: { type: Number, default: 150 },
            count: { type: Number, default: 0 },
            totalMonths: { type: Number, default: 0 }
        },
        community: {
            score: { type: Number, default: 0 },
            maxScore: { type: Number, default: 50 },
            posts: { type: Number, default: 0 },
            followers: { type: Number, default: 0 }
        }
    },
    // Score history for tracking growth
    scoreHistory: [
        {
            score: Number,
            badge: String,
            recordedAt: { type: Date, default: Date.now }
        }
    ],
    lastCalculated: {
        type: Date,
        default: null
    }
}, { timestamps: true });


// getFullProfile does a findOne on this for every profile render.
fyncScoreSchema.index({ user: 1 }, { unique: true });

const FyncScore = mongoose.model("FyncScore", fyncScoreSchema);
export default FyncScore;
