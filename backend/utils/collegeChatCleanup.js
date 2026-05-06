import cron from "node-cron";
import CollegeChat from "../models/collegeChat.model.js";
import { deleteFromR2 } from "./r2.js";

// Run at exactly 12:00 AM every night to purge the campus loop
export const initCollegeChatCleanup = () => {
    cron.schedule("0 0 * * *", async () => {
        try {
            console.log("🌕 Midnight Strike: Purging college campus loops...");
            
            // 1. Find all messages that have any media attached
            const messagesWithMedia = await CollegeChat.find({ 
                mediaUrl: { $exists: true, $ne: null, $ne: "" }
            });

            if (messagesWithMedia.length > 0) {
                console.log(`🧹 Cleaning up media for ${messagesWithMedia.length} messages...`);
                // Parallelize R2 deletions for maximum speed
                const mediaDeletions = messagesWithMedia.map(msg => 
                    deleteFromR2(msg.mediaUrl).catch(e => console.error(`❌ Media delete failed: ${msg.mediaUrl}`))
                );
                await Promise.allSettled(mediaDeletions);
            }

            // 2. Wipe the entire collection for a fresh start
            const result = await CollegeChat.deleteMany({});
            
            console.log(`✅ Nightly Reset Complete. Purged ${result.deletedCount} messages and all associated media.`);
        } catch (error) {
            console.error("❌ Error in midnight college chat cleanup:", error);
        }
    });
};
