import redisClient from "../../utils/redis.js";
import { escapeRegExp } from "../../utils/escapeRegExp.js";
import { nanoid } from "nanoid";
import Problem from "../../models/coding/problem.model.js";
import { runSubmission } from "../../services/codeRunner.service.js";
import { languageOf } from "../../utils/codeHarness.js";
import CodingSubmission from "../../models/coding/codingSubmission.model.js";
import { getSocketAcrossCluster } from "../../utils/socketCluster.js";

const codingBattleSockets = (io) => {
  io.on("connection", (socket) => {
    
    socket.on("find_coding_match", async ({ userId, difficulty }) => {
      const queueKey = `coding_queue:${difficulty || 'medium'}`;
      
      // Look for opponent
      const opponentString = await redisClient.rPop(queueKey);
      
      if (!opponentString) {
        // Join queue
        const queueEntry = JSON.stringify({ userId, socketId: socket.id });
        await redisClient.lPush(queueKey, queueEntry);
        socket.codingQueueKey = queueKey;
        socket.codingQueueEntry = queueEntry;
        socket.emit("searching_opponent");
        return;
      }

      const opponent = JSON.parse(opponentString);
      if (opponent.userId === userId) {
        await redisClient.lPush(queueKey, opponentString);
        return;
      }

      const opponentSocket = await getSocketAcrossCluster(io, opponent.socketId);
      if (!opponentSocket) {
        // Try again
        return socket.emit("find_coding_match", { userId, difficulty });
      }

      // Match Found
      const matchRoomId = `coding_battle:${nanoid(8)}`;
      socket.join(matchRoomId);
      opponentSocket.join(matchRoomId);

      // Fetch a random problem of that difficulty
      const problems = await Problem.find({ difficulty: { $regex: new RegExp(escapeRegExp(difficulty), "i") } });
      const problem = problems[Math.floor(Math.random() * problems.length)];

      const battleData = {
        roomId: matchRoomId,
        problem: problem || { title: "Demo Problem", description: "Solve this!", difficulty },
        startTime: new Date(),
        participants: {
          [userId]: { progress: 0, socketId: socket.id },
          [opponent.userId]: { progress: 0, socketId: opponent.socketId }
        }
      };

      await redisClient.set(matchRoomId, JSON.stringify(battleData), { EX: 3600 });

      io.to(matchRoomId).emit("coding_match_found", {
        matchRoomId,
        problem: battleData.problem,
        opponentId: opponent.userId
      });
    });

    socket.on("code_update", ({ matchRoomId, userId, progress }) => {
      // Small optimization: only emit progress, not full code to save bandwidth
      socket.to(matchRoomId).emit("opponent_progress", { userId, progress });
    });

    // Reconnect / navigating client joins an existing battle room
    socket.on("join_battle", async (matchRoomId) => {
      try {
        const battleDataString = await redisClient.get(matchRoomId);
        if (!battleDataString) {
          socket.emit("battle_error", { message: "Battle room not found or expired" });
          return;
        }
        const battleData = JSON.parse(battleDataString);
        socket.join(matchRoomId);
        socket.emit("battle_sync", battleData);
      } catch (err) {
        console.error("Join Battle Error:", err);
        socket.emit("battle_error", { message: "Failed to join battle" });
      }
    });

    socket.on("submit_solution", async ({ matchRoomId, userId, code, languageId }) => {
      try {
        const battleDataString = await redisClient.get(matchRoomId);
        if (!battleDataString) return;
        const battleData = JSON.parse(battleDataString);
        const problem = await Problem.findById(battleData.problem._id);

        // Notify that submission is processing
        io.to(matchRoomId).emit("submission_processing", { userId });

        // In a 1v1 the loser is decided by who is slower, so the old
        // per-case submit-and-poll loop was the match: forty cases at up to ten
        // seconds of polling each meant the result arrived long after both
        // players had stopped caring. One batched execution settles it.
        const verdict = await runSubmission({
          language: languageOf(languageId),
          code,
          cases: problem.testCases,
          problemId: String(problem._id),
          timeLimitMs: problem.timeLimit || 2000,
        });

        const passedCount = verdict.passed;
        const totalCount = problem.testCases.length;
        const isSuccess = verdict.status === 'Accepted';
        
        // Save to DB
        await CodingSubmission.create({
          user: userId,
          problem: problem._id,
          code,
          languageId,
          status: verdict.status,
          passedCount,
          totalCount
        });

        io.to(matchRoomId).emit("submission_result", { 
          userId, 
          passedCount, 
          totalCount,
          status: verdict.status,
          isSuccess
        });

        if (isSuccess) {
          io.to(matchRoomId).emit("battle_end", { winnerId: userId });
          await redisClient.del(matchRoomId);
        }
      } catch (err) {
        console.error("Socket Submission Error:", err);
      }
    });

    // Cancel an active matchmaking search
    socket.on("cancel_coding_match", async ({ userId, difficulty }) => {
      const queueKey = `coding_queue:${difficulty || 'medium'}`;
      try {
        const entry = JSON.stringify({ userId, socketId: socket.id });
        await redisClient.lRem(queueKey, 1, entry);
        socket.codingQueueKey = null;
        socket.codingQueueEntry = null;
        socket.emit("coding_match_cancelled");
      } catch (err) {
        console.error("Cancel coding match error:", err);
      }
    });

    socket.on("leave_battle", (matchRoomId) => {
      socket.to(matchRoomId).emit("opponent_left");
      socket.leave(matchRoomId);
    });

    socket.on("disconnect", async () => {
      // Remove this socket from any matchmaking queue it was waiting in
      if (socket.codingQueueKey && socket.codingQueueEntry) {
        try {
          await redisClient.lRem(socket.codingQueueKey, 0, socket.codingQueueEntry);
        } catch (err) {
          console.error("Coding disconnect cleanup error:", err);
        }
      }
    });
  });
};

export default codingBattleSockets;
