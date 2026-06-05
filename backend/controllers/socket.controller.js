import Message from "../models/chat.model.js";
import { sendPushNotification } from "../utils/notification.js";
import Conversation from "../models/conversation.model.js";
import Room from "../models/quiz/room.model.js";
import Submission from "../models/quiz/submission.model.js";
import User from "../models/user.model.js";
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

    socket.on("register", async (userId) => {
      if (!userId) return;
      socket.userId = userId;
      socket.join(`user:${userId}`);

      try {
        await redisClient.sAdd(`user_sockets:${userId}`, socket.id);
        await redisClient.sAdd("global_online_users", userId);

        // Let the user know who is already online
        const onlineList = await redisClient.sMembers("global_online_users");
        socket.emit("initialOnlineList", onlineList);

        io.emit("statusUpdate", { userId, status: "online" });
      } catch (err) {
        console.error("Redis register error:", err);
      }
    });


    socket.on("join", ({ conversationId }) => {
      if (!conversationId) return;
      socket.join(conversationId);
    });

    socket.on("join_college_room", ({ collegeName }) => {
      if (!collegeName) return;
      socket.join(`college_${collegeName}`);
    });

    socket.on("leave_college_room", ({ collegeName }) => {
      if (!collegeName) return;
      socket.leave(`college_${collegeName}`);
    });

    socket.on("join_alumni_room", ({ college, graduationYear }) => {
      if (!college || !graduationYear) return;
      const roomName = `alumni_${college.replace(/\s+/g, '_')}_${graduationYear}`;
      socket.join(roomName);
    });

    socket.on("leave_alumni_room", ({ college, graduationYear }) => {
      if (!college || !graduationYear) return;
      const roomName = `alumni_${college.replace(/\s+/g, '_')}_${graduationYear}`;
      socket.leave(roomName);
    });

    socket.on("alumni_typing", ({ college, graduationYear, username }) => {
      if (!college || !graduationYear) return;
      const roomName = `alumni_${college.replace(/\s+/g, '_')}_${graduationYear}`;
      socket.to(roomName).emit("alumni_user_typing", { username });
    });

    socket.on("alumni_stop_typing", ({ college, graduationYear, username }) => {
      if (!college || !graduationYear) return;
      const roomName = `alumni_${college.replace(/\s+/g, '_')}_${graduationYear}`;
      socket.to(roomName).emit("alumni_user_stop_typing", { username });
    });

    socket.on("join_mentorship_room", ({ college }) => {
      if (!college) return;
      const roomName = `mentorship_${college.replace(/\s+/g, '_')}`;
      socket.join(roomName);
    });

    socket.on("leave_mentorship_room", ({ college }) => {
      if (!college) return;
      const roomName = `mentorship_${college.replace(/\s+/g, '_')}`;
      socket.leave(roomName);
    });

    socket.on("mentorship_typing", ({ college, username }) => {
      if (!college) return;
      const roomName = `mentorship_${college.replace(/\s+/g, '_')}`;
      socket.to(roomName).emit("mentorship_user_typing", { username });
    });

    socket.on("mentorship_stop_typing", ({ college, username }) => {
      if (!college) return;
      const roomName = `mentorship_${college.replace(/\s+/g, '_')}`;
      socket.to(roomName).emit("mentorship_user_stop_typing", { username });
    });

    // Socket Chat Handlers (Migrated to Supabase)
    // sendMessage, markSeen, deleteMessage have been removed as Supabase handles the database layer.
    // However, we still use Socket.IO for transient events (typing, notifications).
    socket.on("typing", ({ conversationId, username }) => {
      if (!conversationId) return;
      socket.to(conversationId).emit("user_typing", { conversationId, username });
    });

    socket.on("stopTyping", ({ conversationId, username }) => {
      if (!conversationId) return;
      socket.to(conversationId).emit("user_stop_typing", { conversationId, username });
    });

    socket.on("chat_notify", async ({ receiverId, title, body }) => {
      try {
        await sendPushNotification(receiverId, title, body, { type: "chat" });
      } catch (err) {
        console.error("Chat notify error", err);
      }
    });
    
    // --- ECHO COMMUNITIES ---
    socket.on("join_echo_room", ({ subId }) => {
      if (!subId) return;
      socket.join(subId);
      console.log(`👤 User joined Echo room: ${subId}`);
    });

    socket.on("leave_echo_room", ({ subId }) => {
      if (!subId) return;
      socket.leave(subId);
    });

    // --- CLUB MANAGEMENT SYSTEM ---
    socket.on("join_club_room", ({ subGroupId }) => {
      if (!subGroupId) return;
      socket.join(subGroupId);
      console.log(`♣️ User joined Club room: ${subGroupId}`);
    });

    socket.on("leave_club_room", ({ subGroupId }) => {
      if (!subGroupId) return;
      socket.leave(subGroupId);
    });

    // --- EVENT COMMUNITY ---
    socket.on("join_community_room", ({ eventId }) => {
      if (!eventId) return;
      socket.join(`community_${eventId}`);
    });

    socket.on("leave_community_room", ({ eventId }) => {
      if (!eventId) return;
      socket.leave(`community_${eventId}`);
    });

    socket.on("watch_leaderboard", ({ roomId }) => {
      socket.join(roomId);
    });

    // --- 🚀 HACKATHON ECOSYSTEM ---
    socket.on("identity", async (userId) => {
      if (!userId) return;
      socket.userId = userId;
      socket.join(`user:${userId}`);
      
      try {
        await redisClient.sAdd(`user_sockets:${userId}`, socket.id);
        await redisClient.sAdd("global_online_users", userId);
        console.log(`👤 User identified: ${userId}`);
      } catch (err) {
        console.error("Redis identity error:", err);
      }
    });

    socket.on("join:hackathon", ({ hackathonId }) => {
      if (!hackathonId) return;
      socket.join(`hack:${hackathonId}`);
      console.log(`🚀 Joined hack room: hack:${hackathonId}`);
    });

    socket.on("leave:hackathon", ({ hackathonId }) => {
      if (!hackathonId) return;
      socket.leave(`hack:${hackathonId}`);
    });

    socket.on("join:team", ({ teamId }) => {
      if (!teamId) return;
      socket.join(`team:${teamId}`);
      console.log(`👥 Joined team room: team:${teamId}`);
    });

    socket.on("leave:team", ({ teamId }) => {
      if (!teamId) return;
      socket.leave(`team:${teamId}`);
    });

    socket.on("subscribe:leaderboard", ({ hackathonId }) => {
      if (!hackathonId) return;
      socket.join(`hack:${hackathonId}:leaderboard`);
    });

    socket.on("typing:start", ({ roomId, userId, username }) => {
      socket.to(roomId).emit("typing:start", { userId, username });
    });

    socket.on("typing:stop", ({ roomId, userId }) => {
      socket.to(roomId).emit("typing:stop", { userId });
    });

    socket.on("join_hack_room", ({ hackathonId }) => { // Backwards compatibility
      if (!hackathonId) return;
      socket.join(`hack:${hackathonId}`);
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
      if (!redisClient.isOpen) {
        socket.emit("error", "Matching service is temporarily unavailable. Please try again later.");
        return;
      }
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
          if (myScore > opScore) {
            result = "WIN";
            await User.findByIdAndUpdate(userId, { $inc: { oneVsOnePoints: 1 } });
          }
          if (myScore < opScore) result = "LOSE";

          let opResult = "DRAW";
          if (opScore > myScore) {
            opResult = "WIN";
            await User.findByIdAndUpdate(opponentId, { $inc: { oneVsOnePoints: 1 } });
          }
          if (opScore < myScore) opResult = "LOSE";

          socket.emit("1v1_result", {
            result, myScore, opScore,
            message: result === "WIN" ? "Victory! +1 Point awarded. 🎉" : result === "LOSE" ? "Defeat 😢" : "It's a Tie! 🤝"
          });

          if (opponentData.socketId) {
            io.to(opponentData.socketId).emit("1v1_result", {
              result: opResult,
              myScore: opScore,
              opScore: myScore,
              message: opResult === "WIN" ? "Victory! +1 Point awarded. 🎉" : opResult === "LOSE" ? "Defeat 😢" : "It's a Tie! 🤝"
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
      try {
        const now = new Date();
        const dateStr = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hourCycle: 'h23' });
        const hourMatch = dateStr.match(/,\s*(\d+):/);
        let hour = hourMatch ? parseInt(hourMatch[1], 10) : now.getHours();
        const isOpen = hour >= 0 && hour < 6; // 00:00 to 05:59

        return { isOpen, hour };
      } catch (e) {
        const hour = new Date().getHours();
        return { isOpen: hour >= 0 && hour < 6, hour };
      }
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

      // Load ephemeral history directly from Redis (lightning fast)
      let historyStrs = [];
      try {
        historyStrs = await redisClient.lRange("night_club:history", 0, 99);
      } catch (e) {
        console.error("Redis history fetch error", e);
      }
      
      const history = historyStrs.map(str => JSON.parse(str)).reverse();

      socket.emit("night_club_joined", {
        history,
        message: "Welcome to the 12 AM Club. What happens here, stays here.",
        closesAt: "06:00 AM"
      });
    });

    socket.on("send_night_message", async ({ senderId, text, tempId, type, mediaUrl, replyTo }) => {
      const { isOpen } = checkClubStatus();

      if (!isOpen) {
        socket.emit("night_club_ended", { message: "The sun is up. Chat deleted." });
        socket.leave("night_club_global");
        return;
      }

      try {
        // 1. Highly Optimized User Caching (Bypass MongoDB)
        let senderStr = await redisClient.get(`user_cache:${senderId}`);
        let sender;
        if (!senderStr) {
          sender = await User.findById(senderId).select("name username avatar").lean();
          if (sender) await redisClient.set(`user_cache:${senderId}`, JSON.stringify(sender), { EX: 3600 });
        } else {
          sender = JSON.parse(senderStr);
        }

        if (!sender) return;

        // 2. Build Message Object
        const msgObj = {
          _id: nanoid(10), // Unique ID without MongoDB
          tempId: tempId || null,
          sender: { _id: sender._id, name: sender.name, username: sender.username, avatar: sender.avatar },
          message: text?.trim() || "",
          messageType: type || 'text',
          fileUrl: mediaUrl || "",
          replyTo: replyTo || null,
          createdAt: new Date().toISOString()
        };

        // 3. Push to Redis & Cap at 100
        await redisClient.lPush("night_club:history", JSON.stringify(msgObj));
        await redisClient.lTrim("night_club:history", 0, 99);

        // 4. Track images for the 6AM deletion sweep
        if (mediaUrl) {
          await redisClient.lPush("night_club:images", mediaUrl);
        }

        io.to("night_club_global").emit("new_night_message", msgObj);

      } catch (err) {
        console.error("Night chat redis storage error:", err);
      }
    });

    // --- 🤫 ANONYMOUS 1-ON-1 CHAT LOGIC ---

    socket.on("find_night_1v1", async ({ userId }) => {
      const { isOpen } = checkClubStatus();
      if (!isOpen) return socket.emit("night_club_error", { message: "Club closed" });

      if (!redisClient.isOpen) {
        socket.emit("night_club_error", { message: "Night Matching service is temporarily unavailable." });
        return;
      }

      const queueKey = "queue:night_1v1";
      
      // Cleanup previous match if any
      const oldRoomId = await redisClient.get(`user:night_1v1:${userId}`);
      if (oldRoomId) {
        io.to(oldRoomId).emit("night_1v1_partner_left");
        await redisClient.del(`user:night_1v1:${userId}`);
      }

      let matchFound = false;

      while (!matchFound) {
        const opponentStr = await redisClient.rPop(queueKey);

        if (!opponentStr) {
          // Queue is empty, add current user to queue
          await redisClient.lPush(queueKey, JSON.stringify({ userId, socketId: socket.id }));
          socket.emit("night_1v1_searching");
          return;
        }

        const opponent = JSON.parse(opponentStr);

        // 1. Don't match with self (even if different socket)
        if (opponent.userId === userId) {
          continue; // Skip and try to find someone else or empty the queue
        }

        // 2. Check if opponent is still online
        const opponentSocket = io.sockets.sockets.get(opponent.socketId);
        if (!opponentSocket) {
          continue; // Opponent left, skip to next in queue
        }

        // Match found!
        matchFound = true;
        const roomId = `night_1v1:${nanoid(8)}`;
        socket.join(roomId);
        opponentSocket.join(roomId);

        await redisClient.set(`user:night_1v1:${userId}`, roomId, { EX: 21600 });
        await redisClient.set(`user:night_1v1:${opponent.userId}`, roomId, { EX: 21600 });

        io.to(roomId).emit("night_1v1_found", { roomId });
      }
    });

    socket.on("send_night_1v1_message", async ({ roomId, senderId, text, type, mediaUrl }) => {
      const { isOpen } = checkClubStatus();
      if (!isOpen) return;

      // Broadcast to partner in the private room with a unique ID for flatlist performance
      socket.to(roomId).emit("new_night_1v1_message", {
        _id: nanoid(10), // Required for heavily optimized FlatList rendering on frontend
        senderId,
        message: text,
        messageType: type || 'text',
        fileUrl: mediaUrl || "",
        createdAt: new Date().toISOString()
      });
    });

    socket.on("skip_night_1v1", async ({ userId, roomId }) => {
      socket.leave(roomId);
      socket.to(roomId).emit("night_1v1_partner_left");
      await redisClient.del(`user:night_1v1:${userId}`);
    });

    socket.on("leave_night_1v1", async ({ userId, roomId }) => {
      socket.leave(roomId);
      socket.to(roomId).emit("night_1v1_partner_left");
      await redisClient.del(`user:night_1v1:${userId}`);
    });

    // --- 🎨 DRAW & GUESS LOGIC ---

    socket.on("find_draw_match", async ({ userId, username }) => {
      if (!redisClient.isOpen) {
        return socket.emit("draw_error", "Matchmaking unavailable");
      }
      
      const queueKey = "queue:draw_match";
      let matchFound = false;

      // Ensure user isn't stuck in an old match
      const oldRoomId = await redisClient.get(`user:draw:${userId}`);
      if (oldRoomId) {
        socket.leave(oldRoomId);
        socket.to(oldRoomId).emit("draw_partner_left");
        await redisClient.del(`user:draw:${userId}`);
      }

      while (!matchFound) {
        const opponentStr = await redisClient.rPop(queueKey);
        
        if (!opponentStr) {
          // Join queue
          await redisClient.lPush(queueKey, JSON.stringify({ userId, socketId: socket.id, username }));
          socket.emit("draw_searching");
          return;
        }

        const opponent = JSON.parse(opponentStr);
        if (opponent.userId === userId) continue;

        const opponentSocket = io.sockets.sockets.get(opponent.socketId);
        if (!opponentSocket) continue;

        matchFound = true;
        const roomId = `draw:${nanoid(8)}`;
        
        socket.join(roomId);
        opponentSocket.join(roomId);

        await redisClient.set(`user:draw:${userId}`, roomId, { EX: 3600 });
        await redisClient.set(`user:draw:${opponent.userId}`, roomId, { EX: 3600 });

        // Assign roles: User 1 is Drawer, User 2 is Guesser
        const words = ["Apple", "Car", "House", "Tree", "Dog", "Cat", "Sun", "Moon", "Pizza", "Computer", "Phone", "Book"];
        const word = words[Math.floor(Math.random() * words.length)];

        socket.emit("draw_match_found", { roomId, role: "drawer", word, opponent: opponent.username });
        opponentSocket.emit("draw_match_found", { roomId, role: "guesser", word: null, opponent: username });
      }
    });

    socket.on("send_draw_data", ({ roomId, strokes }) => {
      socket.to(roomId).emit("receive_draw_data", strokes);
    });

    socket.on("clear_draw_canvas", ({ roomId }) => {
      socket.to(roomId).emit("clear_draw_canvas");
    });

    socket.on("draw_guess", ({ roomId, guess, username }) => {
      // Send guess to other player
      io.to(roomId).emit("draw_guess_received", { guess, username });
    });

    socket.on("draw_leave", async ({ userId, roomId }) => {
      socket.leave(roomId);
      socket.to(roomId).emit("draw_partner_left");
      await redisClient.del(`user:draw:${userId}`);
    });

    socket.on("disconnect", async () => {
      console.log("Socket disconnected:", socket.id);

      if (socket.userId) {
        // Cleanup 1v1 if they were in a match
        const roomId = await redisClient.get(`user:night_1v1:${socket.userId}`);
        if (roomId) {
          io.to(roomId).emit("night_1v1_partner_left");
          await redisClient.del(`user:night_1v1:${socket.userId}`);
        }

        // Cleanup Draw match
        const drawRoomId = await redisClient.get(`user:draw:${socket.userId}`);
        if (drawRoomId) {
          io.to(drawRoomId).emit("draw_partner_left");
          await redisClient.del(`user:draw:${socket.userId}`);
        }

        try {
          await redisClient.sRem(`user_sockets:${socket.userId}`, socket.id);
          const remaining = await redisClient.sCard(`user_sockets:${socket.userId}`);
          
          if (remaining === 0) {
            await redisClient.sRem("global_online_users", socket.userId);
            io.emit("statusUpdate", { userId: socket.userId, status: "offline" });
          }
        } catch (err) {
          console.error("Redis disconnect error:", err);
        }
      }

      const videoId = Object.keys(videoUsers).find(key => videoUsers[key].socketId === socket.id);
      if (videoId) {
        delete videoUsers[videoId];
        io.emit("video_users_update", Object.values(videoUsers));
      }
    });

  });
};