import redisClient from "../../utils/redis.js";
import { escapeRegExp } from "../../utils/escapeRegExp.js";
import { nanoid } from "nanoid";
import Problem from "../../models/coding/problem.model.js";
import { runSubmission } from "../../services/codeRunner.service.js";
import { languageOf } from "../../utils/codeHarness.js";
import CodingSubmission from "../../models/coding/codingSubmission.model.js";
import { getSocketAcrossCluster } from "../../utils/socketCluster.js";
import CodingTeam from "../../models/coding/codingTeam.model.js";

/**
 * The battle payload used to be the raw Problem document, hidden test cases
 * included. In a race where the winner is whoever passes the hidden cases
 * first, shipping their expected outputs to both clients decided the match
 * before it started.
 */
const publicProblem = (problem) => {
  if (!problem) return null;
  const plain = problem.toObject ? problem.toObject() : problem;
  return { ...plain, testCases: (plain.testCases ?? []).filter((tc) => !tc.isHidden) };
};

/**
 * A random problem of the requested difficulty, sampled by the database.
 *
 * The old version loaded every problem of that difficulty into memory to index
 * one of them; with a seeded bank that is thousands of documents per match.
 * Only problems with hidden cases are eligible — a battle judged on the cases
 * both players can read is won by pasting the expected output.
 */
const randomProblem = async (difficulty) => {
  const match = { "testCases.isHidden": true };
  if (difficulty) match.difficulty = { $regex: new RegExp(`^${escapeRegExp(difficulty)}$`, "i") };
  const [problem] = await Problem.aggregate([{ $match: match }, { $sample: { size: 1 } }]);
  return problem ?? null;
};

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

      const problem = await randomProblem(difficulty);
      if (!problem) {
        socket.emit("battle_error", { message: "No judgeable problems at that difficulty yet." });
        opponentSocket.emit("battle_error", { message: "No judgeable problems at that difficulty yet." });
        return;
      }

      const battleData = {
        roomId: matchRoomId,
        mode: "1v1",
        problemId: String(problem._id),
        startTime: new Date(),
        participants: {
          [userId]: { progress: 0, socketId: socket.id },
          [opponent.userId]: { progress: 0, socketId: opponent.socketId }
        }
      };

      await redisClient.set(matchRoomId, JSON.stringify(battleData), { EX: 3600 });

      io.to(matchRoomId).emit("coding_match_found", {
        matchRoomId,
        problem: publicProblem(problem),
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
        // Redis holds only the problem id, so a reconnecting client cannot be
        // handed the hidden cases by replaying the stored payload.
        const problem = await Problem.findById(battleData.problemId);
        socket.emit("battle_sync", { ...battleData, problem: publicProblem(problem) });
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
        const problem = await Problem.findById(battleData.problemId);
        if (!problem) return;

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
          // In a team battle the credit belongs to the team, not the member who
          // happened to submit; the client shows a team name either way.
          const winnerTeamId = battleData.teamOf?.[userId] ?? null;
          io.to(matchRoomId).emit("battle_end", { winnerId: userId, winnerTeamId });
          await redisClient.del(matchRoomId);
        }
      } catch (err) {
        console.error("Socket Submission Error:", err);
      }
    });

    /**
     * Team battles: two teams of two get the same problem, and the first team
     * with an accepted submission wins.
     *
     * Members join a room named for their team so a match reaches both of them
     * regardless of which one pressed the button, and regardless of whether the
     * second member had even connected when the search started.
     */
    socket.on("join_team_room", async ({ teamId, userId }) => {
      const team = await CodingTeam.findById(teamId).select("leader members");
      const isMember = team && [team.leader, ...team.members].some((m) => String(m) === String(userId));
      if (!isMember) return socket.emit("battle_error", { message: "You are not on that team." });
      socket.join(`team:${teamId}`);
      socket.emit("team_room_joined", { teamId });
    });

    socket.on("find_team_match", async ({ teamId, userId, difficulty }) => {
      try {
        const team = await CodingTeam.findById(teamId).select("name leader members");
        if (!team) return socket.emit("battle_error", { message: "Team not found." });

        const roster = [team.leader, ...team.members].map(String);
        if (!roster.includes(String(userId))) {
          return socket.emit("battle_error", { message: "You are not on that team." });
        }
        // Both seats must be filled, or a "2v2" is a 1v2 and the match is
        // decided by headcount rather than by solving.
        if (new Set(roster).size < 2) {
          return socket.emit("battle_error", { message: "Your team needs 2 members before it can queue." });
        }

        const queueKey = `coding_team_queue:${difficulty || "medium"}`;
        const entry = JSON.stringify({ teamId: String(teamId), name: team.name });

        const opponentString = await redisClient.rPop(queueKey);
        if (!opponentString) {
          await redisClient.lPush(queueKey, entry);
          socket.codingQueueKey = queueKey;
          socket.codingQueueEntry = entry;
          io.to(`team:${teamId}`).emit("searching_opponent", { teamId });
          return;
        }

        const opponent = JSON.parse(opponentString);
        if (opponent.teamId === String(teamId)) {
          // Own entry came back around; put it back rather than matching a team
          // against itself.
          await redisClient.lPush(queueKey, opponentString);
          return;
        }

        const problem = await randomProblem(difficulty);
        if (!problem) {
          await redisClient.lPush(queueKey, opponentString);
          return socket.emit("battle_error", { message: "No judgeable problems at that difficulty yet." });
        }

        const matchRoomId = `coding_battle:${nanoid(8)}`;
        io.in(`team:${teamId}`).socketsJoin(matchRoomId);
        io.in(`team:${opponent.teamId}`).socketsJoin(matchRoomId);

        // Members are resolved to a flat map so submit_solution can credit a
        // winning submission to a team without another database read.
        const opponentTeam = await CodingTeam.findById(opponent.teamId).select("leader members");
        const teamOf = {};
        for (const m of roster) teamOf[m] = String(teamId);
        for (const m of [opponentTeam?.leader, ...(opponentTeam?.members ?? [])]) {
          if (m) teamOf[String(m)] = String(opponent.teamId);
        }

        const battleData = {
          roomId: matchRoomId,
          mode: "team",
          problemId: String(problem._id),
          startTime: new Date(),
          teamOf,
          teams: [
            { id: String(teamId), name: team.name },
            { id: String(opponent.teamId), name: opponent.name },
          ],
        };

        await redisClient.set(matchRoomId, JSON.stringify(battleData), { EX: 3600 });

        io.to(matchRoomId).emit("team_match_found", {
          matchRoomId,
          problem: publicProblem(problem),
          teams: battleData.teams,
        });
      } catch (err) {
        console.error("Team match error:", err);
        socket.emit("battle_error", { message: "Failed to start team match." });
      }
    });

    socket.on("cancel_team_match", async ({ teamId, difficulty }) => {
      const queueKey = `coding_team_queue:${difficulty || "medium"}`;
      try {
        // Rebuilt rather than remembered: the member who cancels may not be the
        // one whose socket queued.
        const team = await CodingTeam.findById(teamId).select("name");
        await redisClient.lRem(queueKey, 0, JSON.stringify({ teamId: String(teamId), name: team?.name }));
        socket.codingQueueKey = null;
        socket.codingQueueEntry = null;
        io.to(`team:${teamId}`).emit("coding_match_cancelled");
      } catch (err) {
        console.error("Cancel team match error:", err);
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
