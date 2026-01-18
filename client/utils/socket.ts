import io from "socket.io-client";

const socket = io("http://10.21.70.187:3000", {
  transports: ["websocket"],
});

export default socket;