import Message from "../models/chat.model.js";

export const getChatMessages = async (req, res) => {
    try {
        const messages = await Message.find({ roomId: req.params.roomId })
            .populate("sender receiver", "name avatar username");

        return res.status(200).json({ success: true, messages });
    } catch (err) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
