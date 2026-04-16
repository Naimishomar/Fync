import redisClient from "../../utils/redis.js";
import { nanoid } from "nanoid";
import Problem from "../../models/coding/problem.model.js";

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

    socket.on("submit_solution", async ({ matchRoomId, userId, code, language }) => {
      // In a real app, you'd call Judge0 or similar here
      // For demo: randomly pass some test cases
      const passedCount = Math.floor(Math.random() * 5); // Mock 0-4 cases passed
      const totalCount = 5;
      
      const progress = (passedCount / totalCount) * 100;
      
      io.to(matchRoomId).emit("submission_result", { 
        userId, 
        passedCount, 
        totalCount,
        isSuccess: passedCount === totalCount
      });

      if (passedCount === totalCount) {
        io.to(matchRoomId).emit("battle_end", { winnerId: userId });
        await redisClient.del(matchRoomId);
      }
    });

    socket.on("leave_battle", (matchRoomId) => {
      socket.to(matchRoomId).emit("opponent_left");
      socket.leave(matchRoomId);
    });
  });
};

export default codingBattleSockets;
