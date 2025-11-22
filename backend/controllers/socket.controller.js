import Message from "../models/chat.model.js";

export const socketController = (io) => {
    io.on("connection", (socket) => {
        console.log("User connected:", socket.id);

        socket.on("joinRoom", ({ roomId }) => {
            socket.join(roomId);
            console.log(`User joined room: ${roomId}`);
        });

        socket.on("sendMessage", async (data) => {
            const { sender, receiver, message, roomId, productId } = data;
            const newMessage = await Message.create({
                sender,
                receiver,
                product: productId || null,
                message,
            });
            io.to(roomId).emit("newMessage", newMessage);
        });

        socket.on("typing", ({ roomId, username }) => {
            socket.to(roomId).emit("typing", username);
        });

        socket.on("stopTyping", ({ roomId }) => {
            socket.to(roomId).emit("stopTyping");
        });

        socket.on("markSeen", async ({ messageId, roomId }) => {
            await Message.findByIdAndUpdate(messageId, { seen: true });
            io.to(roomId).emit("messageSeen", messageId);
        });

        socket.on("disconnect", () => {
            console.log("User disconnected:", socket.id);
        });
    });
};
