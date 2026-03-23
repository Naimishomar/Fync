import NightMessage from "../models/newFeatures/nightChat.model.js";

export const uploadNightImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No image provided" });
        }
        return res.status(200).json({ 
            success: true, 
            fileUrl: req.file.path 
        });
    } catch (error) {
        console.error("Night image upload error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
