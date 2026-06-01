import mongoose from "mongoose";

const gameScoreSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    gameName: {
      type: String,
      enum: ["FlappyBird", "DrawAndGuess"],
      required: true,
    },
    highScore: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Compound index to quickly find a user's score for a specific game
gameScoreSchema.index({ user: 1, gameName: 1 }, { unique: true });
// Index to quickly sort high scores for leaderboards
gameScoreSchema.index({ gameName: 1, highScore: -1 });

const GameScore = mongoose.model("GameScore", gameScoreSchema);

export default GameScore;
