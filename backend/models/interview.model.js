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
      enum: [10, 15],
      default: 10,
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
          enum: ["user", "model", "assistant", "system"],
          required: true,
        },
        parts: [
          {
            text: { type: String, required: true },
          },
        ],
      },
    ],
    summary: { type: String, default: "" }
  },
  { timestamps: true }
);

const InterviewSession = mongoose.model("InterviewSession", interviewSchema);

export default InterviewSession;