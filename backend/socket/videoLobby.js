import redisClient from "../utils/redis.js";

const LOBBY_SET = "lobby:users";
const USER_PREFIX = "user:";

export const setupVideoSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    // 1. Join Lobby (Mark as Available)
    socket.on("join-lobby", async (payload) => {
      // Backwards compatibility if payload is just a string (userId)
      const userId = typeof payload === 'object' ? payload.userId : payload;
      const userName = typeof payload === 'object' ? payload.userName : "Unknown User";
      const avatar = typeof payload === 'object' ? payload.myAvatar : "";
      const userUsername = typeof payload === 'object' ? payload.myRealUsername : "";

      try {
        await redisClient.hSet(`${USER_PREFIX}${userId}`, {
          socketId: socket.id,
          status: "available", // Default
          userId: userId,
          userName: userName,
          avatar: avatar,
          userUsername: userUsername
        });
        await redisClient.sAdd(LOBBY_SET, userId);
        await broadcastLobbyState(io);
      } catch (err) {
        console.error("Redis Error:", err);
      }
    });

    // 2. Manual Status Update (Triggered by Zego Events)
    socket.on("set-status", async ({ userId, status }) => {
      // status = 'busy' or 'available'
      try {
        await redisClient.hSet(`${USER_PREFIX}${userId}`, { status });
        await broadcastLobbyState(io); // Update everyone's UI (Red/Green dots)
      } catch (err) {
        console.error("Status Update Error:", err);
      }
    });

    // 3. Leave Lobby
    socket.on("leave-lobby", async (userId) => {
      await redisClient.sRem(LOBBY_SET, userId);
      await redisClient.del(`${USER_PREFIX}${userId}`);
      await broadcastLobbyState(io);
    });

    // 4. Handle Direct Calls (Jitsi routing)
    socket.on("call-user", async ({ targetUserId, callerId, callerName, roomId }) => {
      try {
        const targetUser = await redisClient.hGetAll(`${USER_PREFIX}${targetUserId}`);
        if (targetUser && targetUser.socketId) {
          io.to(targetUser.socketId).emit("incoming-jitsi-call", {
            callerId,
            callerName,
            roomId
          });
        }
      } catch (err) {
        console.error("Call User Error:", err);
      }
    });

    // 5. Handle Call Ending
    socket.on("end-call", ({ roomId }) => {
      socket.broadcast.emit("call-ended", { roomId });
    });

    socket.on("disconnect", () => {
      // Optional: Cleanup logic if you track socketId mapping
    });
  });
};

const broadcastLobbyState = async (io) => {
  const userIds = await redisClient.sMembers(LOBBY_SET);
  if (userIds.length === 0) return;

  const multi = redisClient.multi();
  userIds.forEach((id) => multi.hGetAll(`${USER_PREFIX}${id}`));
  const results = await multi.exec();

  const users = results.map((res) => res).filter(u => u && u.userId);
  io.emit("update-user-list", users);
};