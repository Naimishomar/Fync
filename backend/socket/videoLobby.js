import redisClient from "../utils/redis.js";

const LOBBY_SET = "lobby:users";
const USER_PREFIX = "user:";

export const setupSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    // 1. Join Lobby (Mark as Available)
    socket.on("join-lobby", async (userId) => {
      try {
        await redisClient.hSet(`${USER_PREFIX}${userId}`, {
          socketId: socket.id,
          status: "available", // Default
          userId: userId
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