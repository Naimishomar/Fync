import AsyncStorage from "@react-native-async-storage/async-storage";
import { io } from "socket.io-client";
import { refreshAccessToken } from "../context/axiosConfig";
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

// Auth rejections stop socket.io's own reconnection, so we retry ourselves
// after a token refresh, with backoff and a cap.
const MAX_AUTH_RETRIES = 5;
let authRetries = 0;
let authRetryTimer: ReturnType<typeof setTimeout> | null = null;

socket.on("connect", () => {
  authRetries = 0;
  if (trackedUserId) {
    // The server derives identity from the token; these emits only ask it to
    // join the rooms for this session.
    socket.emit("register");
    socket.emit("identity");
  }
});

socket.on("connect_error", (err) => {
  // A middleware rejection ("Unauthorized") is final for socket.io: it will not
  // reconnect on its own. Get a fresh token (sharing axios's refresh) and retry.
  if (err.message !== "Unauthorized" || !trackedUserId) return;
  if (authRetryTimer || authRetries >= MAX_AUTH_RETRIES) return;
  const delay = Math.min(1000 * 2 ** authRetries, 30000);
  authRetries++;
  authRetryTimer = setTimeout(async () => {
    authRetryTimer = null;
    if (!trackedUserId) return;
    try {
      await refreshAccessToken();
    } catch {
      // Refresh failed; fall back to whatever token storage has now.
    }
    if (trackedUserId && (await attachToken())) socket.connect();
  }, delay);
});

// Call once auth is ready so the user is always present (online status,
// chat_notify, typing) even when no chat screen is mounted.
export const trackUser = async (userId: string | null | undefined) => {
  if (!userId) return;
  trackedUserId = userId;
  authRetries = 0;
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
  authRetries = 0;
  if (authRetryTimer) clearTimeout(authRetryTimer);
  authRetryTimer = null;
  socket.auth = {};
  socket.disconnect();
};

export default socket;
