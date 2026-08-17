import AsyncStorage from "@react-native-async-storage/async-storage";
import { io } from "socket.io-client";
const SOCKET_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// The server now authenticates the handshake with the access token, so the
// socket cannot connect before we have one — hence autoConnect: false.
const socket = io(SOCKET_URL, {
  transports: ["websocket"],
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 45000,
});

let trackedUserId: string | null = null;

const attachToken = async () => {
  const token = await AsyncStorage.getItem("accessToken");
  if (!token) return false;
  socket.auth = { token };
  return true;
};

socket.on("connect", () => {
  if (trackedUserId) {
    // The server derives identity from the token; these emits only ask it to
    // join the rooms for this session.
    socket.emit("register");
    socket.emit("identity");
  }
});

socket.on("connect_error", async (err) => {
  // axios refreshes the access token in the background; pick up the new one
  // before socket.io's next reconnection attempt so we don't loop on a stale JWT.
  if (err.message === "Unauthorized") {
    await attachToken();
  }
});

// Call once auth is ready so the user is always present (online status,
// chat_notify, typing) even when no chat screen is mounted.
export const trackUser = async (userId: string | null | undefined) => {
  if (!userId) return;
  trackedUserId = userId;
  if (!(await attachToken())) return;
  if (socket.connected) {
    socket.emit("register");
    socket.emit("identity");
  } else {
    socket.connect();
  }
};

export const untrackUser = () => {
  trackedUserId = null;
  socket.auth = {};
  socket.disconnect();
};

export default socket;
