import io from "socket.io-client";

const socket = io("http://10.21.96.28:3000", {
  transports: ["websocket"],
});

export default socket;