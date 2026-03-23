import cron from "node-cron";
import CollegeChat from "../models/collegeChat.model.js";
import { deleteFromCloudinary } from "./cloudinary.js";

// Run every 30 minutes to delete expired messages and their media
export const initCollegeChatCleanup = () => {
    cron.schedule("*/30 * * * *", async () => {
        try {
            console.log("🔹 Running college chat cleanup job...");
            const now = new Date();
            const expiredMessages = await CollegeChat.find({ expiresAt: { $lt: now } });

            if (expiredMessages.length > 0) {
                console.log(`🧹 Found ${expiredMessages.length} expired college chat messages to clean.`);
                
                for (let msg of expiredMessages) {
                    if (msg.mediaUrl && msg.messageType !== 'text') {
                        let resourceType = 'image';
                        if (msg.messageType === 'video' || msg.messageType === 'voice') resourceType = 'video';
                        if (msg.messageType === 'file') resourceType = 'raw';
                        
                        try {
                            await deleteFromCloudinary(msg.mediaUrl, resourceType);
                        } catch (e) {
                            console.error("❌ Cleanup cloudinary error:", e);
                        }
                    }
                    await CollegeChat.findByIdAndDelete(msg._id);
                }
                console.log(`✅ Cleaned up ${expiredMessages.length} expired college chat documents.`);
            }
        } catch (error) {
            console.error("❌ Error in college chat cleanup cron:", error);
        }
    });
};
