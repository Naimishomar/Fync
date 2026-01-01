import Message from "../models/chat.model.js";
import Conversation from "../models/conversation.model.js";
import Room from "../models/quiz/room.model.js";
import Submission from "../models/quiz/submission.model.js";
import redisClient from "../utils/redis.js";
import { generateQuestions } from "../utils/gemini.js";
import { nanoid } from "nanoid";

const calculateScore = (userAnswers, correctQuestions) => {
  if (!userAnswers || !correctQuestions) return 0;
  let score = 0;
  userAnswers.forEach((ans, index) => {
    if (ans === correctQuestions[index].correctAnswer) score += 1;
  });
  return score;
};

export const socketController = (io) => {
  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("join", ({ conversationId }) => {
      if (!conversationId) return;
      socket.join(conversationId);
    });

    socket.on("sendMessage", async ({ conversationId, senderId, text }) => {
      try {
        if (!conversationId || !senderId || !text?.trim()) return;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return;
        const receiverId = conversation.participants.find(
          id => id.toString() !== senderId
        );

        if (!receiverId) return;

        let message = await Message.create({
          conversationId,
          sender: senderId,
          message: text.trim()
        });

        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: message._id,
          $inc: { [`unreadCount.${receiverId}`]: 1 }
        });

        message = await message.populate(
          "sender",
          "name username avatar"
        );

        io.to(conversationId).emit("newMessage", message);
      } catch (err) {
        console.error("sendMessage error:", err);
      }
    });

    socket.on("markSeen", async ({ conversationId, userId }) => {
      try {
        if (!conversationId || !userId) return;

        await Conversation.findByIdAndUpdate(conversationId, {
          [`unreadCount.${userId}`]: 0
        });
      } catch (err) {
        console.error("markSeen error:", err);
      }
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
    });

    socket.on("watch_leaderboard", ({ roomId }) => {
        socket.join(roomId);
    });

    socket.on("join_custom_room", async ({ roomId, userId }) => {
        try {
            console.log(`User ${userId} joining room ${roomId}`);
            
            const room = await Room.findOne({ roomId });
            if (!room) {
                socket.emit("error", "Room not found");
                return;
            }

            // 🛑 FIX: CHECK IF ALREADY ATTEMPTED
            const existingSubmission = await Submission.findOne({ roomId, user: userId });
            
            if (existingSubmission) {
                console.log(`User ${userId} already attempted room ${roomId}`);
                // Tell frontend to redirect to Leaderboard immediately
                socket.emit("already_attempted", { roomId });
                return; // Stop execution here!
            }

            // A. Check Time Logic
            const now = new Date();
            const startTime = new Date(room.startTime);
            const endTime = new Date(startTime.getTime() + room.duration * 60000);

            if (now > endTime) {
                socket.emit("quiz_ended", { roomId });
                return;
            }

            // B. Join Socket Room
            socket.join(roomId);

            // C. Start / Schedule Quiz
            const delay = startTime.getTime() - now.getTime();
            
            if (delay <= 0) {
                // Start Immediately
                socket.emit("start_quiz", { 
                    questions: room.questions, 
                    endTime: endTime.toISOString() 
                });
            } else {
                // Wait for start
                console.log(`Quiz starts in ${delay/1000} seconds`);
                setTimeout(() => {
                    io.to(roomId).emit("start_quiz", { 
                        questions: room.questions, 
                        endTime: endTime.toISOString() 
                    });
                }, delay);
            }
        } catch (err) {
            console.error("Join Room Error:", err);
        }
    });

    socket.on("submit_custom_quiz", async ({ roomId, answers, userId }) => {
        try {
            const exists = await Submission.exists({ roomId, user: userId });
            if (exists) {
                console.log("Duplicate submission rejected");
                return; 
            }
            const room = await Room.findOne({ roomId });
            if (!room) return;

            const score = calculateScore(answers, room.questions);

            // Upsert submission
            await Submission.findOneAndUpdate(
                { roomId, user: userId },
                { 
                    roomId, user: userId, score, 
                    totalQuestions: room.questions.length, answers 
                },
                { upsert: true, new: true }
            );

            socket.emit("quiz_completed", { score, total: room.questions.length });
            io.to(roomId).emit("leaderboard_updated");
        } catch (err) {
            console.error("Submit Error:", err);
        }
    });

    socket.on("find_1v1_match", async ({ user, domain }) => {
      const queueKey = `queue:${domain}`;
      const userId = user._id;

      // Loop until we find a valid opponent or the queue is empty
      let opponentFound = false;
      
      while (!opponentFound) {
        // 1. Check Redis for waiting user
        const opponentString = await redisClient.rPop(queueKey);

        if (!opponentString) {
            // Queue is empty, add self and stop
            const userData = JSON.stringify({ 
                userId: user._id, 
                socketId: socket.id,
                username: user.username,
                name: user.name,
                avatar: user.avatar
            });
            await redisClient.lPush(queueKey, userData);
            return; 
        }

        const opponent = JSON.parse(opponentString);

        // 2. Prevent self-match (if user clicked find twice quickly)
        if (opponent.userId === userId) {
             // Put it back and continue (or just discard if it's stale)
             await redisClient.lPush(queueKey, opponentString);
             return;
        }

        // 3. CHECK IF OPPONENT IS ONLINE [CRITICAL FIX]
        const opponentSocket = io.sockets.sockets.get(opponent.socketId);

        if (!opponentSocket) {
            console.log(`Opponent ${opponent.username} is offline. Discarding and searching next...`);
            // Opponent is gone. Loop continues to find the next person.
            continue; 
        }

        // --- MATCH FOUND & VALID ---
        opponentFound = true;
        const matchRoomId = `match:${nanoid(6)}`;

        // Join Rooms
        opponentSocket.join(matchRoomId);
        socket.join(matchRoomId);

        // Notify "Preparing..."
        io.to(matchRoomId).emit("match_preparing");

        // Generate Data
        const questions = await generateQuestions(domain);
        
        // Calculate End Time (Now + 5 mins)
        const endTime = new Date(Date.now() + 5 * 60000).toISOString();

        // Store State in Redis
        const matchData = {
            questions,
            participants: {
                [userId]: { score: null, socketId: socket.id, name: user.name },
                [opponent.userId]: { score: null, socketId: opponent.socketId, name: opponent.name }
            }
        };
        await redisClient.set(matchRoomId, JSON.stringify(matchData), { EX: 900 });

        // EMIT TO USER
        socket.emit("match_found", {
          matchRoomId,
          questions,
          endTime,
          opponent: {
              username: opponent.username,
              name: opponent.name,
              avatar: opponent.avatar
          }
        });

        // EMIT TO OPPONENT
        opponentSocket.emit("match_found", {
            matchRoomId,
            questions,
            endTime,
            opponent: {
                username: user.username,
                name: user.name,
                avatar: user.avatar
            }
        });
      }
    });

    // --- SUBMIT 1v1 (Unchanged logic, just ensure imports match) ---
    socket.on("submit_1v1", async ({ matchRoomId, answers, userId }) => {
        try {
            const dataString = await redisClient.get(matchRoomId);
            if (!dataString) return; 
            
            const match = JSON.parse(dataString);
            const score = calculateScore(answers, match.questions);
            
            // Check if participant exists to prevent crashes
            if (match.participants[userId]) {
                match.participants[userId].score = score;
            }

            const participantIds = Object.keys(match.participants);
            const opponentId = participantIds.find(id => id !== userId);
            
            // Safety Check: Ensure opponent exists in data
            if (!opponentId) return;
            const opponentData = match.participants[opponentId];

            if (opponentData && opponentData.score !== null) {
                // BOTH FINISHED
                const myScore = score;
                const opScore = opponentData.score;

                let result = "DRAW";
                if (myScore > opScore) result = "WIN";
                if (myScore < opScore) result = "LOSE";

                let opResult = "DRAW";
                if (opScore > myScore) opResult = "WIN";
                if (opScore < myScore) opResult = "LOSE";

                socket.emit("1v1_result", { 
                    result, myScore, opScore,
                    message: result === "WIN" ? "You Won! 🎉" : result === "LOSE" ? "You Lost 😢" : "It's a Tie! 🤝"
                });

                // Safety Check: Ensure opponent socket is still connected
                if(opponentData.socketId) {
                    io.to(opponentData.socketId).emit("1v1_result", { 
                        result: opResult, 
                        myScore: opScore, 
                        opScore: myScore,
                        message: opResult === "WIN" ? "You Won! 🎉" : opResult === "LOSE" ? "You Lost 😢" : "It's a Tie! 🤝"
                    });
                }
                await redisClient.del(matchRoomId);
            } else {
                // WAIT
                await redisClient.set(matchRoomId, JSON.stringify(match), { EX: 900 });
                socket.emit("waiting_for_opponent");
            }
        } catch (err) {
            console.error("Redis Error in Submit:", err);
        }
    });
  });
};
