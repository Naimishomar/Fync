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

// Judge progress dashboard, judge pending/scored lists, leaderboard rebuild
ScoreSchema.index({ hackathon: 1, judge: 1 });
ScoreSchema.index({ hackathon: 1, submission: 1 });

// Compute weighted totalScore from per-criteria scores (0–10 scale)
ScoreSchema.pre("save", function (next) {
  if (this.criteria && this.criteria.length) {
    let weighted = 0;
    let totalWeight = 0;
    for (const c of this.criteria) {
      const w = Number(c.weightage) || 0;
      const s = Number(c.score) || 0;
      weighted += s * w;
      totalWeight += w;
    }
    this.totalScore = totalWeight > 0
      ? parseFloat((weighted / totalWeight).toFixed(2))
      : 0;
  } else {
    this.totalScore = 0;
  }
  next();
});

const Score = mongoose.model("Score", ScoreSchema);
export default Score;