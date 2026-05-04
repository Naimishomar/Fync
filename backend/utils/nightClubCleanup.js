import cron from "node-cron";
import NightMessage from "../models/newFeatures/nightChat.model.js";
import { deleteFromR2 } from "./r2.js";

// Run every 10 minutes to clean up expired night messages and their R2 assets
export const initNightClubCleanup = () => {
    cron.schedule("*/10 * * * *", async () => {
        try {
            const now = new Date();
            const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
            
            const expiredMessages = await NightMessage.find({
                createdAt: { $lt: sixHoursAgo }
            });

            if (expiredMessages.length > 0) {
                console.log(`🌙 12AM Club: Processing ${expiredMessages.length} expired messages...`);
                
                const deletions = expiredMessages
                    .filter(msg => msg.fileUrl && msg.messageType === 'image')
                    .map(msg => deleteFromR2(msg.fileUrl).catch(e => console.error("R2 cleanup error (12AM Club):", e.message)));
                
                await Promise.allSettled(deletions);

                const expiredIds = expiredMessages.map(m => m._id);
                await NightMessage.deleteMany({ _id: { $in: expiredIds } });
                
                console.log(`🌙 12AM Club: Cleaned up ${expiredMessages.length} expired messages.`);
            }

            // Also, at 6 AM, wipe EVERYTHING just in case
            const hour = now.getHours();
            const minute = now.getMinutes();
            if (hour === 6 && minute >= 0 && minute <= 10) {
                const remaining = await NightMessage.find();
                if (remaining.length > 0) {
                    const finalDeletions = remaining
                        .filter(msg => msg.fileUrl && msg.messageType === 'image')
                        .map(msg => deleteFromR2(msg.fileUrl).catch(() => {}));
                    
                    await Promise.allSettled(finalDeletions);
                    await NightMessage.deleteMany({});
                    console.log("☀️ 12AM Club: Daily sunrise wipe completed.");
                }
            }

        } catch (error) {
            console.error("12AM Cleanup error:", error);
        }
    });
};
