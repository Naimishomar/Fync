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
import { getSocketAcrossCluster } from "../utils/socketCluster.js";
import { getPresenceAudience, filterOnline, broadcastStatus } from "../utils/presence.js";
import { checkClubStatus, nightPseudonym } from "../utils/nightClub.js";
import { claimCall, confirmCall, endCall as endCallState, releaseIfPeer, getPeer } from "../utils/callState.js";
import { removeFromQueue } from "../utils/quizQueue.js";
import SubGroup from "../models/club/subGroup.model.js";
import SubCommunity from "../models/community/subCommunity.model.js";
import { notifyChatPeer } from "./chat.controller.js";
import {
  isObjectId, isBlockedPair, popNightPartner, rememberNightMessage, fileReport, nightPartnerKey,
} from "./safety.controller.js";

// 12 AM Club data must not outlive one night even if the sunrise sweep misses.
const NIGHT_KEY_TTL_SECONDS = 8 * 60 * 60;

const calculateScore = (userAnswers, correctQuestions) => {
  if (!userAnswers || !correctQuestions) return 0;
  let score = 0;
  userAnswers.forEach((ans, index) => {
    if (ans === correctQuestions[index].correctAnswer) score += 1;
  });
  return score;
};

// Questions as the players see them. correctAnswer used to ride along in
// match_found / start_quiz, so anyone could read the answers off the socket;
// grading already happens server-side in calculateScore.
const publicQuestions = (questions = []) =>
  questions.map(({ question, options }) => ({ question, options }));

const RESULT_MESSAGE = { WIN: "Victory! +1 Point awarded. 🎉", LOSE: "Defeat 😢", DRAW: "It's a Tie! 🤝" };
const outcome = (mine, theirs) => (mine > theirs ? "WIN" : mine < theirs ? "LOSE" : "DRAW");

// Presence keys are refreshed on every (re)connect; anything older than this
// belongs to a socket whose worker died without cleaning up.
const PRESENCE_TTL_SECONDS = 24 * 60 * 60;

export const socketController = (io) => {
  io.on("connection", (socket) => {
    if (process.env.NODE_ENV !== "production") {
      console.log("Socket connected:", socket.id);
    }

    // socket.userId is set by the JWT handshake middleware in index.js. Any
    // userId arriving in an event payload is attacker-controlled, so overwrite
    // it with the authenticated one before a handler ever sees it. Doing this
    // once here covers every handler below instead of 20 individual checks.
    socket.use((packet, next) => {
      const payload = packet[1];
      if (payload && typeof payload === "object" && !Array.isArray(payload)) {
        if ("userId" in payload) payload.userId = socket.userId;
        // Some handlers (chess/quiz matchmaking) take a whole `user` object.
        if (payload.user && typeof payload.user === "object") {
          payload.user._id = socket.userId;
        }
      }
      next();
    });

    socket.on("register", async () => {
      const userId = socket.userId;
      if (!userId) return;
      socket.join(`user:${userId}`);

      try {
        await redisClient.sAdd(`user_sockets:${userId}`, socket.id);
        // If a worker dies, its disconnect handlers never run and the socket ids
        // it added stay in this set forever — the user then shows as permanently
        // online and never gets a fresh presence entry. A TTL lets it self-heal.
        await redisClient.expire(`user_sockets:${userId}`, PRESENCE_TTL_SECONDS);
        await redisClient.sAdd("global_online_users", userId);

        // Only the people this user can actually chat with, not all 10k online.
        const audience = await getPresenceAudience(userId);
        socket.emit("initialOnlineList", await filterOnline(audience));

        await broadcastStatus(io, userId, "online");
      } catch (err) {
        console.error("Redis register error:", err);
      }
    });


    // Every room name used to come straight from the payload, so a socket could
    // join `user:<anyone>` and receive their calls, badges and notifications, or
    // any conversation/club room. Each join now checks membership first.
    socket.on("join", async ({ conversationId } = {}) => {
      if (!socket.userId || !isObjectId(conversationId)) return;
      try {
        if (await Conversation.exists({ _id: conversationId, participants: socket.userId })) {
          socket.join(conversationId);
        }
      } catch (err) {
        console.error("Conversation join error:", err.message);
      }
    });

    socket.on("join_college_room", ({ collegeName }) => {
      if (!collegeName) return;
      socket.join(`college_${collegeName}`);
    });

    socket.on("leave_college_room", ({ collegeName }) => {
      if (!collegeName) return;
      socket.leave(`college_${collegeName}`);
    });

    // The room is the caller's own batch from the database, never the payload,
    // and only for alumni — the same rule the alumni REST endpoints apply.
    socket.on("join_alumni_room", async () => {
      if (!socket.userId) return;
      try {
        const me = await User.findById(socket.userId).select("college graduationYear user_access").lean();
        if (me?.user_access !== "alumni" || !me.college || !me.graduationYear) return;
        socket.join(`alumni_${me.college.replace(/\s+/g, '_')}_${me.graduationYear}`);
      } catch (err) {
        console.error("Alumni join error:", err.message);
      }
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

    // title is ignored: the server names the sender. See notifyChatPeer.
    socket.on("chat_notify", async ({ receiverId, body } = {}) => {
      try {
        await notifyChatPeer(socket.userId, receiverId, body, io);
      } catch (err) {
        console.error("Chat notify error", err);
      }
    });
    
    // --- ECHO COMMUNITIES ---
    // Echo rooms are readable by anyone over REST, so existence is the check;
    // the ObjectId shape alone rules out reserved names like `user:<id>`.
    socket.on("join_echo_room", async ({ subId } = {}) => {
      if (!isObjectId(subId)) return;
      try {
        if (await SubCommunity.exists({ _id: subId })) socket.join(subId);
      } catch (err) {
        console.error("Echo join error:", err.message);
      }
    });

    socket.on("leave_echo_room", ({ subId }) => {
      if (!subId) return;
      socket.leave(subId);
    });

    // --- CLUB MANAGEMENT SYSTEM ---
    // Same membership rule as getClubMessages / postClubMessage.
    socket.on("join_club_room", async ({ subGroupId } = {}) => {
      if (!socket.userId || !isObjectId(subGroupId)) return;
      try {
        const subGroup = await SubGroup.findById(subGroupId)
          .select("members admins clubId")
          .populate("clubId", "admins")
          .lean();
        if (!subGroup) return;
        const has = (arr) => (arr || []).some((id) => String(id) === socket.userId);
        if (has(subGroup.members) || has(subGroup.admins) || has(subGroup.clubId?.admins)) {
          socket.join(subGroupId);
        }
      } catch (err) {
        console.error("Club join error:", err.message);
      }
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

    // Only real custom-quiz room codes; the room only ever carries
    // `leaderboard_updated`.
    socket.on("watch_leaderboard", async ({ roomId } = {}) => {
      if (typeof roomId !== "string" || !roomId) return;
      try {
        if (await Room.exists({ roomId })) socket.join(roomId);
      } catch (err) {
        console.error("Leaderboard join error:", err.message);
      }
    });

    // --- 🚀 HACKATHON ECOSYSTEM ---
    socket.on("identity", async () => {
      // Identity comes from the verified handshake token, never from the client.
      const userId = socket.userId;
      if (!userId) return;
      socket.join(`user:${userId}`);

      try {
        await redisClient.sAdd(`user_sockets:${userId}`, socket.id);
        await redisClient.expire(`user_sockets:${userId}`, PRESENCE_TTL_SECONDS);
        await redisClient.sAdd("global_online_users", userId);
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

    socket.on("leave_hack_room", ({ hackathonId }) => { // Backwards compatibility
      if (!hackathonId) return;
      socket.leave(`hack:${hackathonId}`);
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
            questions: publicQuestions(room.questions),
            endTime: endTime.toISOString()
          });
        } else {
          setTimeout(() => {
            io.to(roomId).emit("start_quiz", {
              questions: publicQuestions(room.questions),
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
      if (!redisClient.isReady) {
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
          // Remember where we queued so cancel/disconnect can take us out.
          socket.data.quizQueue = queueKey;
          return;
        }

        const opponent = JSON.parse(opponentString);

        if (opponent.userId === userId) {
          await redisClient.lPush(queueKey, opponentString);
          return;
        }

        const opponentSocket = await getSocketAcrossCluster(io, opponent.socketId);

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
          questions: publicQuestions(questions),
          endTime,
          opponent: {
            username: opponent.username,
            name: opponent.name,
            avatar: opponent.avatar
          }
        });

        opponentSocket.emit("match_found", {
          matchRoomId,
          questions: publicQuestions(questions),
          endTime,
          opponent: {
            username: user.username,
            name: user.name,
            avatar: user.avatar
          }
        });
      }
    });

    // Leave the 1v1 queue. Uses the queue this socket actually joined (not the
    // payload's domain), so it can only remove its own entry. Safe if not queued.
    socket.on("cancel_1v1_match", async () => {
      const queueKey = socket.data.quizQueue;
      socket.data.quizQueue = null;
      try {
        await removeFromQueue(redisClient, queueKey, socket.id);
      } catch (err) {
        console.error("Cancel 1v1 error:", err);
      }
    });

    socket.on("submit_1v1", async ({ matchRoomId, answers } = {}) => {
      const userId = socket.userId;
      try {
        if (typeof matchRoomId !== "string" || !matchRoomId.startsWith("match:")) return;
        const dataString = await redisClient.get(matchRoomId);
        if (!dataString) return;

        const match = JSON.parse(dataString);
        if (!match.participants[userId]) return;
        const opponentId = Object.keys(match.participants).find(id => id !== userId);
        if (!opponentId) return;

        // One score key per player, first write wins. The old code rewrote the
        // shared match blob, so simultaneous submits lost each other's score,
        // and a resubmit after the opponent finished awarded the point again.
        const scoreKey = (id) => `${matchRoomId}:score:${id}`;
        await redisClient.set(scoreKey(userId), String(calculateScore(answers, match.questions)), { NX: true, EX: 900 });
        const [mine, theirs] = await redisClient.mGet([scoreKey(userId), scoreKey(opponentId)]);
        if (theirs === null) {
          socket.emit("waiting_for_opponent");
          return;
        }

        // Both scores are in. Exactly one submit wins this claim and settles.
        const claimed = await redisClient.set(`${matchRoomId}:settled`, "1", { NX: true, EX: 900 });
        if (!claimed) return;

        const myScore = Number(mine);
        const opScore = Number(theirs);
        const result = outcome(myScore, opScore);
        const opResult = outcome(opScore, myScore);
        if (result === "WIN") await User.findByIdAndUpdate(userId, { $inc: { oneVsOnePoints: 1 } });
        if (opResult === "WIN") await User.findByIdAndUpdate(opponentId, { $inc: { oneVsOnePoints: 1 } });

        socket.emit("1v1_result", { result, myScore, opScore, message: RESULT_MESSAGE[result] });
        const opponentSocketId = match.participants[opponentId].socketId;
        if (opponentSocketId) {
          io.to(opponentSocketId).emit("1v1_result", {
            result: opResult, myScore: opScore, opScore: myScore, message: RESULT_MESSAGE[opResult]
          });
        }
        await redisClient.del(matchRoomId);
      } catch (err) {
        console.error("Redis Error in Submit:", err);
      }
    });

    // --- 🌙 THE 12 AM CLUB LOGIC ---

    // Hours, timezone and countdowns all live in utils/nightClub.js now — see
    // the note there on why local-time arithmetic was wrong on a UTC box.

    socket.on("join_night_club", async () => {
      const { isOpen, msUntilOpen } = checkClubStatus();

      if (!isOpen) {
        socket.emit("night_club_error", {
          message: "The Club is closed. The bouncer will not let you in.",
          opensIn: msUntilOpen, // milliseconds until 00:00 IST, for the countdown
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
        // The caller's own pseudonym. Nothing else identifies a sender now, so
        // without this the client could not tell its own messages apart.
        youAre: socket.userId ? nightPseudonym(socket.userId) : null,
        message: "Welcome to the 12 AM Club. What happens here, stays here.",
        closesAt: "06:00 AM"
      });
    });

    socket.on("send_night_message", async ({ text, tempId, type, mediaUrl, replyTo }) => {
      // senderId used to come from the payload, so a client could post under
      // another user's alias just by changing it. The socket's authenticated
      // identity is the only trustworthy source.
      const senderId = socket.userId;
      const { isOpen } = checkClubStatus();

      if (!isOpen) {
        socket.emit("night_club_ended", { message: "The sun is up. Chat deleted." });
        socket.leave("night_club_global");
        return;
      }

      try {
        // A per-night pseudonym, never the account id. The client derives the
        // alias and avatar from this; it is unlinkable to the user without the
        // server's key, and it changes every night.
        if (!senderId) return;

        const msgObj = {
          _id: nanoid(10), // Unique ID without MongoDB
          tempId: tempId || null,
          sender: { id: nightPseudonym(senderId) },
          message: text?.trim() || "",
          messageType: type || 'text',
          fileUrl: mediaUrl || "",
          replyTo: replyTo || null,
          createdAt: new Date().toISOString()
        };

        // Deliver first. Persistence is only for late joiners' scrollback, so a
        // Redis hiccup should not silently swallow a live message — which is
        // what happened when the lPush threw before the emit.
        io.to("night_club_global").emit("new_night_message", msgObj);

        try {
          // Who really sent it, so a report can reach them. Never broadcast.
          await rememberNightMessage(msgObj._id, senderId, msgObj.message, msgObj.fileUrl);
          await redisClient.lPush("night_club:history", JSON.stringify(msgObj));
          await redisClient.lTrim("night_club:history", 0, 99);
          // Backstop TTL. If the 06:00 sweep does not run — cron worker down,
          // deploy in progress — "what happens here stays here" must still be
          // true rather than silently keeping the night forever.
          await redisClient.expire("night_club:history", NIGHT_KEY_TTL_SECONDS);

          if (mediaUrl) {
            await redisClient.lPush("night_club:images", mediaUrl);
            await redisClient.expire("night_club:images", NIGHT_KEY_TTL_SECONDS);
          }
        } catch (err) {
          console.error("Night chat redis storage error (message was still delivered):", err.message);
        }

      } catch (err) {
        console.error("Night chat send error:", err);
      }
    });

    // --- 🤫 ANONYMOUS 1-ON-1 CHAT LOGIC ---

    socket.on("find_night_1v1", async () => {
      const { isOpen } = checkClubStatus();
      if (!isOpen) return socket.emit("night_club_error", { message: "Club closed" });

      // Authenticated identity, not a payload field — otherwise one client could
      // queue, skip or disconnect another user's match by passing their id.
      const userId = socket.userId;
      if (!userId) return;

      if (!redisClient.isReady) {
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

      // Blocked pairs (explicit, or a 1v1 partner one of them reported) are
      // skipped and keep their place in the queue for someone else.
      const found = await popNightPartner(redisClient, queueKey, userId, {
        isAlive: (opponent) => getSocketAcrossCluster(io, opponent.socketId),
        isBlocked: isBlockedPair,
      });

      if (!found) {
        // Queue is empty, add current user to queue
        await redisClient.lPush(queueKey, JSON.stringify({ userId, socketId: socket.id }));
        socket.emit("night_1v1_searching");
        return;
      }

      const { opponent, socket: opponentSocket } = found;
      const roomId = `night_1v1:${nanoid(8)}`;
      socket.join(roomId);
      opponentSocket.join(roomId);

      await redisClient.set(`user:night_1v1:${userId}`, roomId, { EX: 21600 });
      await redisClient.set(`user:night_1v1:${opponent.userId}`, roomId, { EX: 21600 });
      // Who each side was last paired with, so `report_night_partner` works
      // even after the partner skipped. Overwritten by the next match.
      await redisClient.set(nightPartnerKey(userId), String(opponent.userId), { EX: 21600 });
      await redisClient.set(nightPartnerKey(opponent.userId), String(userId), { EX: 21600 });

      io.to(roomId).emit("night_1v1_found", { roomId });
    });

    socket.on("send_night_1v1_message", async ({ roomId, text, type, mediaUrl } = {}) => {
      const { isOpen } = checkClubStatus();
      if (!isOpen) return;
      if (!socket.userId) return;
      // Only into the room the server paired this user into, never any room name.
      if (!roomId || roomId !== (await redisClient.get(`user:night_1v1:${socket.userId}`))) return;

      const messageId = nanoid(10);
      await rememberNightMessage(messageId, socket.userId, text, mediaUrl);

      // Broadcast to partner in the private room with a unique ID for flatlist performance
      socket.to(roomId).emit("new_night_1v1_message", {
        _id: messageId, // Required for heavily optimized FlatList rendering on frontend
        // Pseudonym, not the account id — this is the "Secret 1v1" mode.
        senderId: nightPseudonym(socket.userId),
        message: text,
        messageType: type || 'text',
        fileUrl: mediaUrl || "",
        createdAt: new Date().toISOString()
      });
    });

    socket.on("skip_night_1v1", async ({ roomId }) => {
      const userId = socket.userId;
      socket.leave(roomId);
      socket.to(roomId).emit("night_1v1_partner_left");
      await redisClient.del(`user:night_1v1:${userId}`);
    });

    socket.on("leave_night_1v1", async ({ roomId }) => {
      const userId = socket.userId;
      socket.leave(roomId);
      socket.to(roomId).emit("night_1v1_partner_left");
      await redisClient.del(`user:night_1v1:${userId}`);
    });

    // --- 🚩 12 AM CLUB REPORTS ---
    // Senders are pseudonymous, so the reporter names a message id or "my
    // partner" and the server resolves the real account. Answers via the
    // socket.io ack callback when given, else a `night_report_ack` event.
    const replyReport = (ack, targetType, r) => {
      const payload = { ok: r.ok, targetType, message: r.message };
      if (typeof ack === "function") ack(payload);
      else socket.emit("night_report_ack", payload);
    };

    socket.on("report_night_message", async ({ messageId, reason } = {}, ack) => {
      try {
        const r = await fileReport({ reporterId: socket.userId, targetType: "night_message", targetId: messageId, reason });
        replyReport(ack, "night_message", r);
      } catch (err) {
        console.error("Night message report error:", err.message);
        replyReport(ack, "night_message", { ok: false, message: "Could not submit report" });
      }
    });

    socket.on("report_night_partner", async ({ reason } = {}, ack) => {
      try {
        const r = await fileReport({ reporterId: socket.userId, targetType: "night_user", reason });
        replyReport(ack, "night_user", r);
        if (!r.ok) return;
        // Reporting ends the conversation, like a skip.
        const roomId = await redisClient.get(`user:night_1v1:${socket.userId}`);
        if (roomId) {
          socket.to(roomId).emit("night_1v1_partner_left");
          socket.leave(roomId);
          await redisClient.del(`user:night_1v1:${socket.userId}`);
        }
      } catch (err) {
        console.error("Night partner report error:", err.message);
        replyReport(ack, "night_user", { ok: false, message: "Could not submit report" });
      }
    });

    // --- 📞 WEBRTC AUDIO CALL SIGNALING ---
    // These handlers looked the target up with io.sockets.sockets.get(targetUserId),
    // but that map is keyed by socket.id, not user id — so it never matched and
    // every call answered "User not online". It is also worker-local, which breaks
    // once PM2 runs more than one instance. Every user joins `user:<id>` on
    // register/identity, and emitting to that room routes through the Redis
    // adapter to whichever worker holds the socket.
    const callRoom = (targetUserId) => `user:${targetUserId}`;

    const isOnline = async (targetUserId) => {
      if (!targetUserId) return false;
      const sockets = await io.in(callRoom(targetUserId)).fetchSockets();
      return sockets.length > 0;
    };

    // Presence for the call lobby is its own channel: a user going busy is not
    // the same event as going offline, and the chat screens listen to
    // `statusUpdate` for the latter.
    const announceCallStatus = async (userId, status) => {
      try {
        const audience = await getPresenceAudience(userId);
        const rooms = [callRoom(userId), ...audience.map((id) => `user:${id}`)];
        io.to(rooms).emit("call:status", { userId: String(userId), status });
      } catch (err) {
        console.error("announceCallStatus error:", err.message);
      }
    };

    /**
     * Lobby presence, scoped to audio or video.
     *
     * A person is in one room or neither, never both — reading app-wide presence
     * put every online user in both lobbies at once. Joining one lobby leaves
     * the other, so the state cannot be inconsistent.
     */
    socket.on("call:lobby:join", async ({ mode }) => {
      if (mode !== 'audio' && mode !== 'video' || !socket.userId) return;
      const other = mode === 'audio' ? 'video' : 'audio';
      try {
        await redisClient.sRem(`call_lobby:${other}`, socket.userId);
        await redisClient.sAdd(`call_lobby:${mode}`, socket.userId);
      } catch (err) {
        console.error("Lobby join failed:", err.message);
      }
    });

    socket.on("call:lobby:leave", async () => {
      if (!socket.userId) return;
      try {
        await redisClient.sRem('call_lobby:audio', socket.userId);
        await redisClient.sRem('call_lobby:video', socket.userId);
      } catch (err) {
        console.error("Lobby leave failed:", err.message);
      }
    });

    // The caller's first ICE candidates are emitted milliseconds after the
    // offer, before claimCall has stored the pairing. isPairedWith waits for
    // this socket's in-flight offer so those candidates are not dropped.
    let offerInFlight = Promise.resolve();
    socket.on("call:offer", (payload) => {
      offerInFlight = handleOffer(payload || {}).catch((err) => console.error("call:offer error:", err.message));
      return offerInFlight;
    });

    const handleOffer = async ({ targetUserId, sdp }) => {
      const callerId = socket.userId;
      if (!callerId || !targetUserId) return;

      if (!(await isOnline(targetUserId))) {
        return socket.emit("call:failed", { reason: "User not online" });
      }

      // The busy check used to live only in the callee's client, so two callers
      // could ring the same person at once and a client that missed the event
      // rang anyway. One atomic claim decides it.
      const claim = await claimCall(callerId, targetUserId);
      if (!claim.ok) {
        return socket.emit("call:busy", {
          reason: claim.busy === "caller"
            ? "You are already on a call"
            : "User is on another call",
        });
      }

      await Promise.all([
        announceCallStatus(callerId, "busy"),
        announceCallStatus(targetUserId, "busy"),
      ]);

      // Identity is read from the database, never from the caller-supplied
      // payload -- otherwise anyone could ring as anyone. One lookup per call
      // is nothing; calls are rare and the ring screen is the whole point.
      const profile = await User.findById(callerId)
        .select("name username avatar college")
        .lean();

      io.to(callRoom(targetUserId)).emit("call:incoming", {
        callerId,
        sdp,
        callerInfo: {
          _id: callerId,
          name: profile?.name || "Fync user",
          username: profile?.username || "",
          avatar: profile?.avatar || "",
          college: profile?.college || "",
        },
      });
    };

    // Signalling relays only between the two users callState paired. Before,
    // any socket could push answers / ICE candidates / busy into anyone's call.
    const isPairedWith = async (targetUserId) => {
      if (!socket.userId || !targetUserId) return false;
      await offerInFlight;
      return String(await getPeer(socket.userId)) === String(targetUserId);
    };

    socket.on("call:answer", async ({ targetUserId, sdp } = {}) => {
      if (!(await isPairedWith(targetUserId))) return;
      // Ringing keys expire in a minute; a live call needs the long lease.
      await confirmCall(socket.userId, targetUserId);
      io.to(callRoom(targetUserId)).emit("call:answered", { sdp });
    });

    socket.on("call:ice-candidate", async ({ targetUserId, candidate } = {}) => {
      if (!(await isPairedWith(targetUserId))) return;
      io.to(callRoom(targetUserId)).emit("call:ice-candidate", { candidate });
    });

    const releaseBothSides = async (userId, peerId) => {
      await Promise.all([
        releaseIfPeer(userId, peerId),
        releaseIfPeer(peerId, userId),
      ]);
      await Promise.all([
        announceCallStatus(userId, "online"),
        announceCallStatus(peerId, "online"),
      ]);
    };

    socket.on("call:end", async ({ targetUserId, reason }) => {
      if (!socket.userId) return;
      const peer = targetUserId || (await getPeer(socket.userId));
      if (!peer) return;
      io.to(callRoom(peer)).emit("call:ended", { reason: reason || "ended" });
      await releaseBothSides(socket.userId, peer);
    });

    socket.on("call:reject", async ({ targetUserId }) => {
      if (!socket.userId) return;
      const peer = targetUserId || (await getPeer(socket.userId));
      if (!peer) return;
      io.to(callRoom(peer)).emit("call:rejected", {});
      await releaseBothSides(socket.userId, peer);
    });

    socket.on("call:busy", async ({ targetUserId } = {}) => {
      if (!(await isPairedWith(targetUserId))) return;
      io.to(callRoom(targetUserId)).emit("call:busy", { reason: "User is on another call" });
    });

    // --- 🎨 DRAW & GUESS LOGIC ---

    socket.on("find_draw_match", async ({ userId, username }) => {
      if (!redisClient.isReady) {
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

        const opponentSocket = await getSocketAcrossCluster(io, opponent.socketId);
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
      if (process.env.NODE_ENV !== "production") {
        console.log("Socket disconnected:", socket.id);
      }

      if (socket.userId) {
        // A dropped socket must not leave the other side of a call stuck
        // waiting, nor leave this user permanently marked busy.
        try {
          const callPeer = await endCallState(socket.userId);
          if (callPeer) {
            io.to(`user:${callPeer}`).emit("call:ended", { reason: "Connection lost" });
            io.to(`user:${callPeer}`).emit("call:status", { userId: String(callPeer), status: "online" });
          }
        } catch (err) {
          console.error("Call cleanup error:", err.message);
        }

        // Drop any queued 1v1 quiz entry so nobody gets matched with a ghost.
        try {
          await removeFromQueue(redisClient, socket.data.quizQueue, socket.id);
        } catch (err) {
          console.error("1v1 queue cleanup error:", err);
        }

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
            // Leaving the app leaves every lobby too, or the ghost comes back.
            await redisClient.sRem("call_lobby:audio", socket.userId);
            await redisClient.sRem("call_lobby:video", socket.userId);
            await broadcastStatus(io, socket.userId, "offline");
          }
        } catch (err) {
          console.error("Redis disconnect error:", err);
        }
      }
    });

  });
};