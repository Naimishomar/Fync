import io from "socket.io-client";

const socket = io("https://fync-backend-ptoy.onrender.com", {
  transports: ["websocket"],
});

export default socket;