import GameScore from "../models/gameScore.model.js";

/**
 * Server-decided multiplayer wins (Spy, Ludo, WordDuel). `highScore` is the
 * win count for these games, so the existing /games/leaderboard works as-is.
 * Fire-and-forget: a failed write must never break the game flow.
 */
export const recordWin = (userId, gameName) =>
    GameScore.updateOne({ user: userId, gameName }, { $inc: { highScore: 1 } }, { upsert: true })
        .exec()
        .catch((e) => console.error(`recordWin ${gameName} failed:`, e.message));
