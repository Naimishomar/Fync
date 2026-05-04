import cron from "node-cron";
import CollegeChat from "../models/collegeChat.model.js";
import { deleteFromR2 } from "./r2.js";

// Run every 30 minutes to delete expired messages and their media
export const initCollegeChatCleanup = () => {
    cron.schedule("*/30 * * * *", async () => {
        try {
            console.log("🔹 Running college chat cleanup job...");
            const now = new Date();
            const expiredMessages = await CollegeChat.find({ expiresAt: { $lt: now } });

            if (expiredMessages.length > 0) {
                console.log(`🧹 Found ${expiredMessages.length} expired college chat messages. Processing...`);
                
                // Parallelize media deletions
                const mediaDeletions = expiredMessages
                    .filter(msg => msg.mediaUrl && msg.messageType !== 'text')
                    .map(msg => deleteFromR2(msg.mediaUrl).catch(e => console.error(`❌ Media delete failed: ${msg.mediaUrl}`, e.message)));
                
                await Promise.allSettled(mediaDeletions);

                // Batch delete from DB
                const expiredIds = expiredMessages.map(m => m._id);
                await CollegeChat.deleteMany({ _id: { $in: expiredIds } });
                
                console.log(`✅ Successfully purged ${expiredMessages.length} college chat documents.`);
            }
        } catch (error) {
            console.error("❌ Error in college chat cleanup cron:", error);
        }
    });
};
