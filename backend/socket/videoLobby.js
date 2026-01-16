import redisClient from "../utils/redis.js";

const LOBBY_SET = "lobby:users";
const USER_PREFIX = "user:";

export const setupSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("Socket connected For Video Callig:", socket.id);

    socket.on("join-lobby", async (userId) => {
      try {
        await redisClient.hSet(`${USER_PREFIX}${userId}`, {
          socketId: socket.id,
          status: "available",
          userId: userId
        });
        await redisClient.sAdd(LOBBY_SET, userId);
        await broadcastLobbyState(io);
      } catch (err) {
        console.error("Redis Error on Join:", err);
      }
    });

    // 2. Handle Calling Logic
    socket.on("call-user", async ({ callerId, targetUserId }) => {
      try {
        const target = await redisClient.hGetAll(`${USER_PREFIX}${targetUserId}`);

        if (!target || !target.socketId) return; // User offline

        if (target.status === "busy") {
          io.to(socket.id).emit("call-busy", { userId: targetUserId });
          return;
        }

        const roomId = `fync-room-${callerId}-${Date.now()}`;

        // Ring the user
        io.to(target.socketId).emit("incoming-call", {
          callerId,
          roomId
        });
      } catch (err) {
        console.error("Redis Error on Call:", err);
      }
    });

    // 3. User Accepts Call
    socket.on("accept-call", async ({ callerId, acceptorId, roomId }) => {
      try {
        const caller = await redisClient.hGetAll(`${USER_PREFIX}${callerId}`);

        // Mark both busy
        // In node-redis v4, hSet updates specific fields without overwriting the whole hash
        await redisClient.hSet(`${USER_PREFIX}${callerId}`, { status: "busy" });
        await redisClient.hSet(`${USER_PREFIX}${acceptorId}`, { status: "busy" });

        // Notify Caller
        if (caller.socketId) {
          io.to(caller.socketId).emit("call-accepted", { roomId });
        }

        await broadcastLobbyState(io);
      } catch (err) {
        console.error("Redis Error on Accept:", err);
      }
    });

    // 4. End Call / Reject
    socket.on("end-call", async ({ userId }) => {
      try {
        await redisClient.hSet(`${USER_PREFIX}${userId}`, { status: "available" });
        await broadcastLobbyState(io);
      } catch (err) {
        console.error("Redis Error on End Call:", err);
      }
    });

    // 5. Cleanup on Disconnect
    socket.on("disconnect", async () => {
      console.log("User disconnected:", socket.id);
      // Optional: Add logic here to remove user from Redis if you want them to disappear immediately
      // e.g., find user by socketId -> remove from set -> broadcast
    });
  });
};

// Helper: Fetch all users and send to everyone
const broadcastLobbyState = async (io) => {
  try {
    // Get all User IDs from the Set
    const userIds = await redisClient.sMembers(LOBBY_SET);

    if (userIds.length === 0) return;

    // Use .multi() for Pipelining in node-redis v4
    const multi = redisClient.multi();
    userIds.forEach((id) => {
      multi.hGetAll(`${USER_PREFIX}${id}`);
    });

    // Execute all commands
    const results = await multi.exec();

    // results is an array of objects directly in v4
    // Filter out empty objects (in case a key was deleted but ID remained in Set)
    const users = results.filter(u => u && u.userId);
    
    io.emit("update-user-list", users);
  } catch (err) {
    console.error("Redis Broadcast Error:", err);
  }
};