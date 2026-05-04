import cron from "node-cron";
import AlumniMessage from "../models/alumniMessage.model.js";
import { deleteFromR2 } from "./r2.js";

// Run every hour to delete expired messages
export const initAlumniChatCleanup = () => {
    cron.schedule("0 * * * *", async () => {
        try {
            console.log("Running alumni chat cleanup job...");
            const now = new Date();
            const expiredMessages = await AlumniMessage.find({ expiresAt: { $lt: now } });

            if (expiredMessages.length > 0) {
                console.log(`🧹 Processing ${expiredMessages.length} expired alumni messages...`);

                const deletions = expiredMessages
                    .filter(msg => msg.fileUrl && msg.messageType !== 'text')
                    .map(msg => deleteFromR2(msg.fileUrl).catch(e => console.error("Alumni cleanup error:", e.message)));
                
                await Promise.allSettled(deletions);

                const expiredIds = expiredMessages.map(m => m._id);
                await AlumniMessage.deleteMany({ _id: { $in: expiredIds } });

                console.log(`✅ Cleaned up ${expiredMessages.length} expired alumni chat messages.`);
            }
        } catch (error) {
            console.error("Error in alumni chat cleanup cron:", error);
        }
    });
};
