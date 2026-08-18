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

// Weighted totalScore from per-criteria scores (0–10 scale)
export const weightedTotal = (criteria) => {
  if (!criteria || !criteria.length) return 0;
  let weighted = 0;
  let totalWeight = 0;
  for (const c of criteria) {
    const w = Number(c.weightage) || 0;
    const s = Number(c.score) || 0;
    weighted += s * w;
    totalWeight += w;
  }
  return totalWeight > 0 ? parseFloat((weighted / totalWeight).toFixed(2)) : 0;
};

ScoreSchema.pre("save", function (next) {
  this.totalScore = weightedTotal(this.criteria);
  next();
});

// submitScore upserts with findOneAndUpdate, which does NOT fire "save".
// Without this hook totalScore stayed undefined on every score ever submitted,
// so the leaderboard ranked every project at 0.
ScoreSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const criteria = update.criteria ?? update.$set?.criteria;
  if (criteria !== undefined) this.set({ totalScore: weightedTotal(criteria) });
  next();
});

const Score = mongoose.model("Score", ScoreSchema);
export default Score;