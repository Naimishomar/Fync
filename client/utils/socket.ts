import { io } from "socket.io-client";
const SOCKET_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

console.log("🔗 Socket attempting connection to:", SOCKET_URL);

const socket = io(SOCKET_URL, {
  transports: ["polling", "websocket"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 45000,
  forceNew: true,
});

socket.on("connect", () => {
  console.log("✅ Socket Connected! ID:", socket.id);
});

socket.on("connect_error", (err) => {
  console.log("❌ Socket Connection Error:", err.message);
});

socket.on("disconnect", (reason) => {
  console.log("🔌 Socket Disconnected:", reason);
});

export default socket;
