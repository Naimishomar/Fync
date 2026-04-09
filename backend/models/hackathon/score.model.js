import mongoose from "mongoose";

const ScoreSchema = mongoose.Schema({
    hackathon: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Hackathon",
        required: true
    },
    submission: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "HackathonSubmission",  // matches the model name in submission.model.js
        required: true
    },
    judge: {                          // was 'judde' (typo)
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    criteria: [{                      // array so multiple criteria can be scored
        name: {
            type: String,
        },
        weightage: {
            type: Number,
        },
        score: {
            type: Number,
            min: 0,
            max: 10
        }
    }],
    totalScore: {
        type: Number
    },
    feedback: {
        type: String
    }
}, {
    timestamps: true
});

// Unique: one score entry per judge+submission pair
ScoreSchema.index({ submission: 1, judge: 1 }, { unique: true });

const Score = mongoose.model("Score", ScoreSchema);
export default Score;