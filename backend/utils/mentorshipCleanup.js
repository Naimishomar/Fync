import cron from "node-cron";
import MentorshipMessage from "../models/mentorshipMessage.model.js";
import { deleteFromR2 } from "./r2.js";

// Run every 12 hours to delete messages older than 7 days
export const initMentorshipCleanup = () => {
    cron.schedule("0 */12 * * *", async () => {
        try {
            console.log("Running mentorship chat cleanup job...");
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            
            const expiredMessages = await MentorshipMessage.find({ 
                createdAt: { $lt: sevenDaysAgo } 
            });

            if (expiredMessages.length > 0) {
                console.log(`🧹 Processing ${expiredMessages.length} expired mentorship messages...`);

                const deletions = expiredMessages
                    .filter(msg => msg.fileUrl && msg.messageType !== 'text')
                    .map(msg => deleteFromR2(msg.fileUrl).catch(e => console.error("R2 cleanup error (mentorship):", e.message)));
                
                await Promise.allSettled(deletions);

                const expiredIds = expiredMessages.map(m => m._id);
                await MentorshipMessage.deleteMany({ _id: { $in: expiredIds } });

                console.log(`✅ Cleaned up ${expiredMessages.length} expired mentorship messages.`);
            }
        } catch (error) {
            console.error("Error in mentorship chat cleanup cron:", error);
        }
    });
};
