import cron from "node-cron";
import CollegeChat from "../models/collegeChat.model.js";
import { deleteFromCloudinary } from "./cloudinary.js";

// Run every hour to delete expired messages
export const initCollegeChatCleanup = () => {
    cron.schedule("0 * * * *", async () => {
        try {
            console.log("Running college chat cleanup job...");
            const now = new Date();
            const expiredMessages = await CollegeChat.find({ expiresAt: { $lt: now } });

            for (let msg of expiredMessages) {
                if (msg.mediaUrl && msg.messageType !== 'text') {
                    let resourceType = 'image';
                    if (msg.messageType === 'video' || msg.messageType === 'voice') resourceType = 'video';
                    if (msg.messageType === 'file') resourceType = 'raw';
                    try {
                        await deleteFromCloudinary(msg.mediaUrl, resourceType);
                    } catch (e) {
                        console.error("Cleanup cloudinary error:", e);
                    }
                }
                await CollegeChat.findByIdAndDelete(msg._id);
            }
            if (expiredMessages.length > 0) {
                console.log(`Cleaned up ${expiredMessages.length} expired college chat messages.`);
            }
        } catch (error) {
            console.error("Error in college chat cleanup cron:", error);
        }
    });
};
