import GameScore from "../models/gameScore.model.js";

export const submitScore = async (req, res) => {
  try {
    const { gameName, score } = req.body;
    const userId = req.user.id;

    if (!gameName || score === undefined) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }

    // Find existing score
    let gameScore = await GameScore.findOne({ user: userId, gameName });

    if (!gameScore) {
      // Create new
      gameScore = await GameScore.create({
        user: userId,
        gameName,
        highScore: score,
      });
    } else {
      // Update if higher
      if (score > gameScore.highScore) {
        gameScore.highScore = score;
        await gameScore.save();
      }
    }

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
