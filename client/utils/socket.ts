import { io } from "socket.io-client";
const SOCKET_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

console.log("🔗 Socket attempting connection to:", SOCKET_URL);

const socket = io(SOCKET_URL, {
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 45000,
  forceNew: true,
});

let trackedUserId: string | null = null;

const registerUser = () => {
  if (trackedUserId && socket.connected) {
    socket.emit("register", trackedUserId);
    socket.emit("identity", trackedUserId);
  }
};

socket.on("connect", () => {
  console.log("✅ Socket Connected! ID:", socket.id);
  registerUser();
});

socket.on("connect_error", (err) => {
  console.log("❌ Socket Connection Error:", err.message);
});

socket.on("disconnect", (reason) => {
  console.log("🔌 Socket Disconnected:", reason);
});

// Call once auth is ready so the user is always present (online status,
// chat_notify, typing) even when no chat screen is mounted.
export const trackUser = (userId: string | null | undefined) => {
  if (!userId) return;
  trackedUserId = userId;
  registerUser();
};

export default socket;