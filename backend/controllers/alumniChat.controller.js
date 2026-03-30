import AlumniMessage from "../models/alumniMessage.model.js";
import User from "../models/user.model.js";
import { deleteFromR2 } from "../utils/r2.js";

let ioInstance = null;

export const setAlumniChatIo = (io) => {
    ioInstance = io;
};

export const sendMessage = async (req, res) => {
    try {
        const { message, messageType, fileName } = req.body;
        const { college, graduationYear } = req.user;

        console.log("📨 SendAlumniMessage Request:", { 
            body: req.body, 
            user: { id: req.user.id, access: req.user.user_access, college, graduationYear },
            hasFile: !!req.file
        });

        if (req.user.user_access !== 'alumni') {
            console.log("❌ Alumni Access Denied:", req.user.user_access);
            return res.status(403).json({ success: false, message: "Access restricted to alumni only." });
        }

        let fileUrl = "";
        if (req.file) {
            if (req.file.size > 5 * 1024 * 1024) {
                return res.status(400).json({ success: false, message: "File size exceeds 5MB limit" });
            }
            fileUrl = req.file.path;
        }

        const newMessage = await AlumniMessage.create({
            college,
            graduationYear,
            sender: req.user.id,
            message: message || "",
            messageType: messageType || "text",
            fileUrl,
            fileName: fileName || ""
        });

        const populatedMessage = await AlumniMessage.findById(newMessage._id)
            .populate("sender", "name username avatar company role");

        if (ioInstance) {
            const roomName = `alumni_${college.replace(/\s+/g, '_')}_${graduationYear}`;
            ioInstance.to(roomName).emit("new_alumni_message", populatedMessage);
        }

        return res.status(201).json({ success: true, message: populatedMessage });
    } catch (error) {
        console.error("Alumni sendMessage error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getMessages = async (req, res) => {
    try {
        const { college, graduationYear } = req.user;
        
        if (req.user.user_access !== 'alumni') {
            return res.status(403).json({ success: false, message: "Access restricted to alumni only." });
        }

        const messages = await AlumniMessage.find({ college, graduationYear })
            .populate("sender", "name username avatar company role")
            .sort({ createdAt: 1 })
            .limit(100);

        return res.status(200).json({ success: true, messages });
    } catch (error) {
        console.log("Error fetching alumni messages", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getMembers = async (req, res) => {
    try {
        const { college, graduationYear } = req.user;

        if (req.user.user_access !== 'alumni') {
            return res.status(403).json({ success: false, message: "Access restricted to alumni only." });
        }

        const members = await User.find({ 
            college, 
            graduationYear, 
            user_access: 'alumni' 
        }).select("name username avatar company role graduationYear");

        return res.status(200).json({ success: true, members });
    } catch (error) {
        console.log("Error fetching alumni members", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const searchAlumni = async (req, res) => {
    try {
        const { college, graduationYear } = req.user;
        const { q } = req.query;

        if (req.user.user_access !== 'alumni') {
            return res.status(403).json({ success: false, message: "Access restricted to alumni only." });
        }

        const query = {
            college,
            graduationYear,
            user_access: 'alumni',
            $or: [
                { name: { $regex: q, $options: 'i' } },
                { username: { $regex: q, $options: 'i' } },
                { company: { $regex: q, $options: 'i' } }
            ]
        };

        const results = await User.find(query).select("name username avatar company role");

        return res.status(200).json({ success: true, results });
    } catch (error) {
        console.log("Error searching alumni", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
export const deleteMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const message = await AlumniMessage.findById(id);

        if (!message) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }

        if (message.sender.toString() !== req.user.id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized to delete this message" });
        }

        if (message.fileUrl && message.messageType !== 'text') {
            let resourceType = 'image';
            if (message.messageType === 'file') resourceType = 'raw';
            await deleteFromR2(message.fileUrl);
        }

        await AlumniMessage.findByIdAndDelete(id);

        if (ioInstance) {
            const roomName = `alumni_${message.college.replace(/\s+/g, '_')}_${message.graduationYear}`;
            ioInstance.to(roomName).emit("delete_alumni_message", id);
        }

        return res.status(200).json({ success: true, message: "Message deleted" });
    } catch (error) {
        console.error("Alumni deleteMessage error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
