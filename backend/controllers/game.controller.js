import GameScore from "../models/gameScore.model.js";

// Scores are client-reported, so each game has a ceiling a real run can't
// pass. DrawAndGuess sends a flat 100 per win; FlappyBird is one point a pipe.
const MAX_SCORE = { FlappyBird: 1000, DrawAndGuess: 100 };

export const submitScore = async (req, res) => {
  try {
    const { gameName, score } = req.body;
    const userId = req.user.id;

    if (!gameName || score === undefined) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }
    const max = Object.hasOwn(MAX_SCORE, gameName) ? MAX_SCORE[gameName] : undefined;
    if (!max) return res.status(400).json({ success: false, message: "Unknown game" });
    if (!Number.isInteger(score) || score < 0 || score > max) {
      return res.status(400).json({ success: false, message: "Invalid score" });
    }

    // Keep the higher of the stored and the new score, in one atomic upsert.
    const gameScore = await GameScore.findOneAndUpdate(
      { user: userId, gameName },
      { $max: { highScore: score } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ success: true, message: "Score submitted successfully", data: gameScore });
  } catch (error) {
    console.error("Error submitting score:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getLeaderboard = async (req, res) => {
  try {
    const { gameName } = req.params;

    if (!gameName) {
      return res.status(400).json({ success: false, message: "Game name required" });
    }

    const leaderboard = await GameScore.find({ gameName })
      .sort({ highScore: -1 })
      .limit(50)
      .populate("user", "name username avatar")
      .lean();

    res.status(200).json({ success: true, leaderboard });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getUserHighestScore = async (req, res) => {
  try {
    const { gameName } = req.params;
    const userId = req.user.id;

    const gameScore = await GameScore.findOne({ user: userId, gameName });

    res.status(200).json({ success: true, score: gameScore ? gameScore.highScore : 0 });
  } catch (error) {
    console.error("Error fetching user score:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
