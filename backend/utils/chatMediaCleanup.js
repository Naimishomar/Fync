import cron from "node-cron";
import Message from "../models/chat.model.js";
import { deleteFromR2 } from "./r2.js";

// Run at exactly 12:00 AM every night to purge media from regular chats
export const initChatMediaCleanup = () => {
    cron.schedule("0 0 * * *", async () => {
        try {
            console.log("🌕 Midnight Strike: Purging media from regular chats...");
            
            // 1. Find all messages that are NOT text (or have mediaUrl)
            const mediaMessages = await Message.find({ 
                messageType: { $ne: "text" },
                mediaUrl: { $exists: true, $ne: "" }
            });

            if (mediaMessages.length > 0) {
                console.log(`🧹 Cleaning up media for ${mediaMessages.length} chat messages...`);
                
                // Parallelize R2 deletions
                const mediaDeletions = mediaMessages.map(msg => 
                    deleteFromR2(msg.mediaUrl).catch(e => console.error(`❌ Chat Media delete failed: ${msg.mediaUrl}`))
                );
                await Promise.allSettled(mediaDeletions);

                // 2. Delete the messages themselves
                const result = await Message.deleteMany({
                    _id: { $in: mediaMessages.map(m => m._id) }
                });
                
                console.log(`✅ Chat Media Reset Complete. Purged ${result.deletedCount} media messages.`);
            } else {
                console.log("✅ No media messages found to purge.");
            }
        } catch (error) {
            console.error("❌ Error in midnight chat media cleanup:", error);
        }
    });
};
