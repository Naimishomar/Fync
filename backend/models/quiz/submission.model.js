import mongoose from "mongoose";

const submissionSchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  score: { type: Number, required: true },
  totalQuestions: { type: Number, required: true },
  answers: [Number],
  submittedAt: { type: Date, default: Date.now }
});

submissionSchema.index({ roomId: 1, user: 1 }, { unique: true });
// Only read as the leaderboard of a live room; rooms expire within hours.
submissionSchema.index({ submittedAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

const Submission = mongoose.model("Submission", submissionSchema);
export default Submission;