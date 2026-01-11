import Message from "../models/chat.model.js";
import Conversation from "../models/conversation.model.js";
import Room from "../models/quiz/room.model.js";
import Submission from "../models/quiz/submission.model.js";
import NightMessage from "../models/newFeatures/nightChat.model.js";
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

let videoUsers = {};

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

    socket.on("watch_leaderboard", ({ roomId }) => {
        socket.join(roomId);
    });

    socket.on("join_custom_room", async ({ roomId, userId }) => {
        try {
            const room = await Room.findOne({ roomId });
            if (!room) {
                socket.emit("error", "Room not found");
                return;
            }

            const existingSubmission = await Submission.findOne({ roomId, user: userId });
            
            if (existingSubmission) {
                socket.emit("already_attempted", { roomId });
                return; 
            }

            const now = new Date();
            const startTime = new Date(room.startTime);
            const endTime = new Date(startTime.getTime() + room.duration * 60000);

            if (now > endTime) {
                socket.emit("quiz_ended", { roomId });
                return;
            }

            socket.join(roomId);

            const delay = startTime.getTime() - now.getTime();
            
            if (delay <= 0) {
                socket.emit("start_quiz", { 
                    questions: room.questions, 
                    endTime: endTime.toISOString() 
                });
            } else {
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
                return; 
            }
            const room = await Room.findOne({ roomId });
            if (!room) return;

            const score = calculateScore(answers, room.questions);

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

      let opponentFound = false;
      
      while (!opponentFound) {
        const opponentString = await redisClient.rPop(queueKey);

        if (!opponentString) {
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

        if (opponent.userId === userId) {
             await redisClient.lPush(queueKey, opponentString);
             return;
        }

        const opponentSocket = io.sockets.sockets.get(opponent.socketId);

        if (!opponentSocket) {
            continue; 
        }

        opponentFound = true;
        const matchRoomId = `match:${nanoid(6)}`;

        opponentSocket.join(matchRoomId);
        socket.join(matchRoomId);

        io.to(matchRoomId).emit("match_preparing");

        const questions = await generateQuestions(domain);
        
        const endTime = new Date(Date.now() + 5 * 60000).toISOString();

        const matchData = {
            questions,
            participants: {
                [userId]: { score: null, socketId: socket.id, name: user.name },
                [opponent.userId]: { score: null, socketId: opponent.socketId, name: opponent.name }
            }
        };
        await redisClient.set(matchRoomId, JSON.stringify(matchData), { EX: 900 });

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

    socket.on("submit_1v1", async ({ matchRoomId, answers, userId }) => {
        try {
            const dataString = await redisClient.get(matchRoomId);
            if (!dataString) return; 
            
            const match = JSON.parse(dataString);
            const score = calculateScore(answers, match.questions);
            
            if (match.participants[userId]) {
                match.participants[userId].score = score;
            }

            const participantIds = Object.keys(match.participants);
            const opponentId = participantIds.find(id => id !== userId);
            
            if (!opponentId) return;
            const opponentData = match.participants[opponentId];

            if (opponentData && opponentData.score !== null) {
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
                await redisClient.set(matchRoomId, JSON.stringify(match), { EX: 900 });
                socket.emit("waiting_for_opponent");
            }
        } catch (err) {
            console.error("Redis Error in Submit:", err);
        }
    });

// --- 🌙 THE 12 AM CLUB LOGIC ---

    const checkClubStatus = () => {
      const now = new Date();
      const hour = now.getHours(); 
      const isOpen = hour >= 0 && hour < 6; // 00:00 to 05:59
      
      return { isOpen, hour };
    };

    socket.on("join_night_club", async () => {
      const { isOpen, hour } = checkClubStatus();

      if (!isOpen) {
        // Calculate time until next 12 AM
        const now = new Date();
        const nextMidnight = new Date(now);
        nextMidnight.setHours(24, 0, 0, 0);
        const msUntilOpen = nextMidnight - now;

        socket.emit("night_club_error", { 
          message: "The Club is closed. The bouncer will not let you in.",
          opensIn: msUntilOpen, // Send milliseconds so frontend can show countdown
          status: "LOCKED" 
        });
        return;
      }

      const roomId = "night_club_global"; // Single global room
      socket.join(roomId);

      // Load ephemeral history (only what hasn't expired yet)
      const history = await NightMessage.find()
        .sort({ createdAt: 1 })
        .populate("sender", "name username avatar")
        .limit(100);

      socket.emit("night_club_joined", { 
        history, 
        message: "Welcome to the 12 AM Club. What happens here, stays here.",
        closesAt: "06:00 AM" 
      });
    });

    socket.on("send_night_message", async ({ senderId, text, tempId }) => {
      const { isOpen } = checkClubStatus();

      if (!isOpen) {
        socket.emit("night_club_ended", { message: "The sun is up. Chat deleted." });
        socket.leave("night_club_global");
        return;
      }

      if (!senderId || !text?.trim()) return;

      try {
        let nightMsg = await NightMessage.create({
          sender: senderId,
          message: text.trim()
        });
        nightMsg = await nightMsg.populate("sender", "name username avatar");
        let msgObj = nightMsg.toObject();
        if (tempId) {
            msgObj.tempId = tempId;
        }
        io.to("night_club_global").emit("new_night_message", msgObj);

      } catch (err) {
        console.error("Night chat error:", err);
      }
    });

    // --- END 12 AM CLUB LOGIC ---

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
      
      const userId = Object.keys(videoUsers).find(key => videoUsers[key].socketId === socket.id);
      if (userId) {
          delete videoUsers[userId];
          io.emit("video_users_update", Object.values(videoUsers));
      }
    });
  });
};