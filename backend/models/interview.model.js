import mongoose from "mongoose";

const interviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    domain: {
      type: String,
      required: true,
    },
    resumeText: {
      type: String, 
      required: true, 
    },
    resumePublicId: {
      type: String,
    },
    audioPublicIds: [
      { type: String }
    ],
    duration: {
      type: Number,
      enum: [5, 10, 15],
      default: 5,
    },
    status: {
      type: String,
      enum: ["active", "completed", "abandoned"],
      default: "active",
    },
    history: [
      {
        role: {
          type: String,
          enum: ["user", "model"],
          required: true,
        },
        parts: [
          {
            text: { type: String, required: true },
          },
        ],
      },
    ],
    report: {
      technical_score: { type: Number, min: 0, max: 10 },
      communication_score: { type: Number, min: 0, max: 10 },
      strengths: [{ type: String }],
      improvements: [{ type: String }],
      verdict: { type: String, enum: ["Pass", "Fail", "Pending"] },
      summary: { type: String }
    }
  },
  { timestamps: true }
);

const InterviewSession = mongoose.model("InterviewSession", interviewSchema);

export default InterviewSession;