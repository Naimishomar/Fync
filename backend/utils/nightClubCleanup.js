import cron from "node-cron";
import NightMessage from "../models/newFeatures/nightChat.model.js";
import { deleteFromR2 } from "./r2.js";

// Run every 10 minutes to clean up expired night messages and their cloudinary assets
export const initNightClubCleanup = () => {
    cron.schedule("*/10 * * * *", async () => {
        try {
            // Find messages that will expire soon or are old
            // Since MongoDB TTL deletes them automatically, we should find them BEFORE they are deleted if we want to clean Cloudinary.
            // However, MongoDB TTL doesn't give a callback.
            // A better way: Delete them manually in the cron job instead of relying on TTL for media handling.
            
            const now = new Date();
            const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
            
            const expiredMessages = await NightMessage.find({
                createdAt: { $lt: sixHoursAgo }
            });

            for (let msg of expiredMessages) {
                if (msg.fileUrl && msg.messageType === 'image') {
                    try {
                        await deleteFromR2(msg.fileUrl);
                    } catch (e) {
                        console.error("12AM Cleanup Cloudinary error:", e);
                    }
                }
                await NightMessage.findByIdAndDelete(msg._id);
            }

            if (expiredMessages.length > 0) {
                console.log(`🌙 12AM Club: Cleaned up ${expiredMessages.length} expired messages.`);
            }

            // Also, at 6 AM, wipe EVERYTHING just in case
            const hour = now.getHours();
            const minute = now.getMinutes();
            if (hour === 6 && minute >= 0 && minute <= 10) {
                const remaining = await NightMessage.find();
                for (let msg of remaining) {
                    if (msg.fileUrl && msg.messageType === 'image') {
                        try { await deleteFromR2(msg.fileUrl); } catch(e){}
                    }
                }
                await NightMessage.deleteMany({});
                console.log("☀️ 12AM Club: Daily sunrise wipe completed.");
            }

        } catch (error) {
            console.error("12AM Cleanup error:", error);
        }
    });
};
