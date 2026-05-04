import CommunityMessage from '../models/community/communityMessage.model.js';
import { deleteFromR2 } from './r2.js';

export const initCommunityCleanup = () => {
    // Run every 24 hours
    setInterval(async () => {
        try {
            console.log("🧹 Running Echo Hub message cleanup...");
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            
            // Find messages with media that are about to expire or already expired
            const expiredMessages = await CommunityMessage.find({ 
                createdAt: { $lt: thirtyDaysAgo },
                $or: [{ image: { $exists: true } }, { video: { $exists: true } }]
            });

            if (expiredMessages.length > 0) {
                const deletions = [];
                expiredMessages.forEach(msg => {
                    if (msg.image) deletions.push(deleteFromR2(msg.image).catch(e => console.error("R2 delete error (image):", e.message)));
                    if (msg.video) deletions.push(deleteFromR2(msg.video).catch(e => console.error("R2 delete error (video):", e.message)));
                });
                
                await Promise.allSettled(deletions);
            }
            
            // Note: MongoDB TTL index will handle the actual document deletion
            console.log(`✅ Cleaned up media for ${expiredMessages.length} expired messages.`);
        } catch (error) {
            console.error("Community cleanup error:", error);
        }
    }, 24 * 60 * 60 * 1000);
};
