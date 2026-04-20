import redisClient from "../../utils/redis.js";
import { nanoid } from "nanoid";
import Problem from "../../models/coding/problem.model.js";
import Judge0Service from "../../services/judge0.service.js";
import CodingSubmission from "../../models/coding/codingSubmission.model.js";

const codingBattleSockets = (io) => {
  io.on("connection", (socket) => {
    
    socket.on("find_coding_match", async ({ userId, difficulty }) => {
      const queueKey = `coding_queue:${difficulty || 'medium'}`;
      
      // Look for opponent
      const opponentString = await redisClient.rPop(queueKey);
      
      if (!opponentString) {
        // Join queue
        await redisClient.lPush(queueKey, JSON.stringify({ userId, socketId: socket.id }));
        socket.emit("searching_opponent");
        return;
      }

      const opponent = JSON.parse(opponentString);
      if (opponent.userId === userId) {
        await redisClient.lPush(queueKey, opponentString);
        return;
      }

      const opponentSocket = io.sockets.sockets.get(opponent.socketId);
      if (!opponentSocket) {
        // Try again
        return socket.emit("find_coding_match", { userId, difficulty });
      }

      // Match Found
      const matchRoomId = `coding_battle:${nanoid(8)}`;
      socket.join(matchRoomId);
      opponentSocket.join(matchRoomId);

      // Fetch a random problem of that difficulty
      const problems = await Problem.find({ difficulty: { $regex: new RegExp(difficulty, "i") } });
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

    socket.on("submit_solution", async ({ matchRoomId, userId, code, languageId }) => {
      try {
        const battleDataString = await redisClient.get(matchRoomId);
        if (!battleDataString) return;
        const battleData = JSON.parse(battleDataString);
        const problem = await Problem.findById(battleData.problem._id);

        // Notify that submission is processing
        io.to(matchRoomId).emit("submission_processing", { userId });

        let passedCount = 0;
        const results = [];

        for (const testCase of problem.testCases) {
          const token = await Judge0Service.submitCode(code, languageId, testCase.input, testCase.expectedOutput);
          let result;
          let attempts = 0;
          while (attempts < 10) {
            result = await Judge0Service.getSubmission(token);
            if (result.status.id > 2) break;
            await new Promise(r => setTimeout(r, 1000));
            attempts++;
          }
          if (result.status.id === 3) passedCount++;
          results.push(result);
        }

        const totalCount = problem.testCases.length;
        const isSuccess = passedCount === totalCount;
        
        // Save to DB
        await CodingSubmission.create({
          user: userId,
          problem: problem._id,
          code,
          languageId,
          status: isSuccess ? 'Accepted' : 'Wrong Answer',
          passedCount,
          totalCount
        });

        io.to(matchRoomId).emit("submission_result", { 
          userId, 
          passedCount, 
          totalCount,
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

    socket.on("leave_battle", (matchRoomId) => {
      socket.to(matchRoomId).emit("opponent_left");
      socket.leave(matchRoomId);
    });
  });
};

export default codingBattleSockets;
