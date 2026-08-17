import { nanoid } from "nanoid";
import redisClient from "../utils/redis.js";
import User from "../models/user.model.js";
import { Chess } from "chess.js";
import { getSocketAcrossCluster } from "../utils/socketCluster.js";

export const setChessIo = (io) => {
  io.on("connection", (socket) => {

    // --- MATCHMAKING ---
    socket.on("find_chess_match", async ({ userId, username, name, avatar }) => {
      if (!redisClient.isOpen) {
        socket.emit("chess_error", "Matching service unavailable.");
        return;
      }

      const queueKey = "queue:chess_1v1";

      // Prevent finding multiple matches if they spam the button
      const oldRoomId = await redisClient.get(`user:chess:${userId}`);
      if (oldRoomId) {
        socket.leave(oldRoomId);
        await redisClient.del(`user:chess:${userId}`);
        io.to(oldRoomId).emit("chess_opponent_left");
      }

      let opponentFound = false;

      while (!opponentFound) {
        const opponentString = await redisClient.rPop(queueKey);

        if (!opponentString) {
          // Add self to queue
          const userData = JSON.stringify({ userId, socketId: socket.id, username, name, avatar });
          await redisClient.lPush(queueKey, userData);
          socket.emit("chess_match_searching");
          return;
        }

        const opponent = JSON.parse(opponentString);

        if (opponent.userId === userId) {
          // Can't match with self
          continue;
        }

        const opponentSocket = await getSocketAcrossCluster(io, opponent.socketId);
        if (!opponentSocket) {
          continue; // opponent disconnected
        }

        opponentFound = true;
        const matchRoomId = `chess:${nanoid(8)}`;

        socket.join(matchRoomId);
        opponentSocket.join(matchRoomId);

        // Store active room for users
        await redisClient.set(`user:chess:${userId}`, matchRoomId, { EX: 3600 });
        await redisClient.set(`user:chess:${opponent.userId}`, matchRoomId, { EX: 3600 });

        // Initialize chess game state
        const initialFen = new Chess().fen();
        
        // Randomly assign colors
        const isWhite = Math.random() > 0.5;
        const whiteUser = isWhite ? { userId, ...userFields(userId, username, name, avatar) } : opponent;
        const blackUser = isWhite ? opponent : { userId, ...userFields(userId, username, name, avatar) };

        const gameData = {
          fen: initialFen,
          white: whiteUser.userId,
          black: blackUser.userId,
          status: "active"
        };

        await redisClient.set(matchRoomId, JSON.stringify(gameData), { EX: 3600 });

        socket.emit("chess_match_found", {
          matchRoomId,
          color: isWhite ? 'w' : 'b',
          opponent: opponent
        });

        opponentSocket.emit("chess_match_found", {
          matchRoomId,
          color: !isWhite ? 'w' : 'b',
          opponent: userFields(userId, username, name, avatar)
        });
      }
    });

    // --- GAMEPLAY ---
    socket.on("chess_move", async ({ matchRoomId, move, fen, userId }) => {
      try {
        const gameDataStr = await redisClient.get(matchRoomId);
        if (!gameDataStr) return;
        
        const gameData = JSON.parse(gameDataStr);

        // Light validation (can be omitted for max speed if trusting client, but checking turn is good)
        // chess.js validation is fast
        const chess = new Chess(gameData.fen);
        try {
          // If move is an object { from, to, promotion }, it works. If string, it works.
          chess.move(move); 
        } catch (e) {
          socket.emit("chess_error", "Invalid move");
          return;
        }

        gameData.fen = chess.fen();
        await redisClient.set(matchRoomId, JSON.stringify(gameData), { EX: 3600 });

        // Broadcast move to opponent
        socket.to(matchRoomId).emit("chess_move_received", { move, fen: gameData.fen });

        // Check end condition
        if (chess.isGameOver()) {
          let reason = "draw";
          let winnerId = null;

          if (chess.isCheckmate()) {
            reason = "checkmate";
            // The one who just moved won
            winnerId = userId;
          } else if (chess.isStalemate()) {
            reason = "stalemate";
          } else if (chess.isThreefoldRepetition()) {
            reason = "repetition";
          }

          io.to(matchRoomId).emit("chess_game_over", { reason, winnerId });

          if (winnerId) {
            // Update Elo or Points asynchronously to not block socket
            User.findByIdAndUpdate(winnerId, { $inc: { fyncCoins: 10 } }).exec().catch(console.error);
          }

          // Cleanup
          await redisClient.del(matchRoomId);
          await redisClient.del(`user:chess:${gameData.white}`);
          await redisClient.del(`user:chess:${gameData.black}`);
        }

      } catch (err) {
        console.error("Chess Move Error:", err);
      }
    });

    socket.on("chess_skip_turn", async ({ matchRoomId, userId }) => {
      try {
        const gameDataStr = await redisClient.get(matchRoomId);
        if (!gameDataStr) return;
        
        const gameData = JSON.parse(gameDataStr);
        const chess = new Chess(gameData.fen);
        
        // Skip turn by mutating the FEN manually (since chess.js doesn't natively support passing turns)
        let fenParts = chess.fen().split(" ");
        fenParts[1] = fenParts[1] === "w" ? "b" : "w"; // Swap color
        fenParts[3] = "-"; // Reset en passant target
        const skippedFen = fenParts.join(" ");

        gameData.fen = skippedFen;
        await redisClient.set(matchRoomId, JSON.stringify(gameData), { EX: 3600 });

        socket.to(matchRoomId).emit("chess_turn_skipped", { fen: skippedFen });
      } catch (err) {
        console.error("Chess Skip Turn Error:", err);
      }
    });

    socket.on("chess_resign", async ({ matchRoomId, userId }) => {
       const gameDataStr = await redisClient.get(matchRoomId);
       if (!gameDataStr) return;
       const gameData = JSON.parse(gameDataStr);
       const winnerId = gameData.white === userId ? gameData.black : gameData.white;

       io.to(matchRoomId).emit("chess_game_over", { reason: "resignation", winnerId });
       
       User.findByIdAndUpdate(winnerId, { $inc: { fyncCoins: 10 } }).exec().catch(console.error);

       await redisClient.del(matchRoomId);
       await redisClient.del(`user:chess:${gameData.white}`);
       await redisClient.del(`user:chess:${gameData.black}`);
    });

    socket.on("leave_chess", async ({ userId, matchRoomId }) => {
        if (matchRoomId) {
            socket.to(matchRoomId).emit("chess_opponent_left");
            const gameDataStr = await redisClient.get(matchRoomId);
            if(gameDataStr) {
                const gameData = JSON.parse(gameDataStr);
                await redisClient.del(`user:chess:${gameData.white}`);
                await redisClient.del(`user:chess:${gameData.black}`);
                await redisClient.del(matchRoomId);
            }
            socket.leave(matchRoomId);
        }
    });

    socket.on("bot_win", async ({ userId }) => {
        try {
            await User.findByIdAndUpdate(userId, { $inc: { fyncCoins: 5 } }).exec();
        } catch (err) {
            console.error("Error awarding bot win coins:", err);
        }
    });

    socket.on("disconnect", async () => {
        // If the user had an active chess match, clean it up
        // Since we don't have direct userId in the disconnect event unless assigned, 
        // we can rely on the fact that socket.userId might be set by the main controller.
        if (socket.userId) {
            const matchRoomId = await redisClient.get(`user:chess:${socket.userId}`);
            if (matchRoomId) {
                io.to(matchRoomId).emit("chess_opponent_left");
                const gameDataStr = await redisClient.get(matchRoomId);
                if (gameDataStr) {
                    const gameData = JSON.parse(gameDataStr);
                    await redisClient.del(`user:chess:${gameData.white}`);
                    await redisClient.del(`user:chess:${gameData.black}`);
                    await redisClient.del(matchRoomId);
                }
            }
        }
    });

  });
};

function userFields(userId, username, name, avatar) {
  return { userId, username, name, avatar };
}
