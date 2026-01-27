import io from "socket.io-client";

const socket = io("http://192.168.28.139:3000", {
  transports: ["websocket"],
});

export default socket;