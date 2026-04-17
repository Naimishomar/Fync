import ContactUs from "../../models/contact us/ContactUs.model.js";

export const contactUs = async (req, res) => {
    try {
        const { name, phone, email, message } = req.body;
        if (!name || !phone || !email || !message) {
            return res.status(400).json({ message: "All fields are required" });
        }
        const images = req.files ? req.files.map(file => file.path) : [];
        
        const contactEntry = await ContactUs.create({
            name,
            phone,
            email,
            message,
            images
        })
        if (!contactEntry) {
            return res.status(400).json({ message: "Failed to submit contact us form" });
        }
        return res.status(201).json({ message: "Contact us form submitted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
}

export const getContactMessages = async (req, res) => {
    try {
        if (req.user.user_access !== 'admin') {
            return res.status(403).json({ message: "Unauthorized", success: false });
        }
        const messages = await ContactUs.find().sort({ createdAt: -1 });
        return res.status(200).json({ success: true, messages });
    } catch (error) {
        console.log("Error in getContactMessages", error);
        return res.status(500).json({ message: "Internal server error", success: false });
    }
}

export const deleteContactMessage = async (req, res) => {
    try {
        if (req.user.user_access !== 'admin') {
            return res.status(403).json({ message: "Unauthorized", success: false });
        }
        const { id } = req.params;
        await ContactUs.findByIdAndDelete(id);
        return res.status(200).json({ message: "Message deleted successfully", success: true });
    } catch (error) {
        console.log("Error in deleteContactMessage", error);
        return res.status(500).json({ message: "Internal server error", success: false });
    }
}

export const toggleContactMessageReadState = async (req, res) => {
    try {
        if (req.user.user_access !== 'admin') {
            return res.status(403).json({ message: "Unauthorized", success: false });
        }
        const { id } = req.params;
        const message = await ContactUs.findById(id);
        if (!message) {
            return res.status(404).json({ message: "Message not found", success: false });
        }
        
        message.isRead = !message.isRead;
        await message.save();
        
        return res.status(200).json({ 
            message: message.isRead ? "Message marked as read" : "Message marked as unread", 
            success: true, 
            isRead: message.isRead 
        });
    } catch (error) {
        console.log("Error in toggleContactMessageReadState", error);
        return res.status(500).json({ message: "Internal server error", success: false });
    }
}