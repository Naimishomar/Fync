import { io } from "socket.io-client";
import axios from '../context/axiosConfig';
const baseURL = axios.defaults.baseURL || "";
const SOCKET_URL = baseURL.split('/api')[0];

console.log("🔗 Socket attempting connection to:", SOCKET_URL);

const socket = io(SOCKET_URL, {
  transports: ["websocket"],
  autoConnect: true,
  reconnection: true,
});

socket.on("connect", () => {
  console.log("✅ Socket Connected! ID:", socket.id);
});

socket.on("connect_error", (err) => {
  console.log("❌ Socket Connection Error:", err.message);
});

export default socket;