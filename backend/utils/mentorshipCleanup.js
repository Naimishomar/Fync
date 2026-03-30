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

            for (let msg of expiredMessages) {
                if (msg.fileUrl && msg.messageType !== 'text') {
                    let resourceType = 'image';
                    if (msg.messageType === 'file') resourceType = 'raw'; // PDFs are 'raw' in some configs or 'image' if PDF allowed in image storage
                    
                    // Note: In our cloudinary config, PDFs are in 'avatar' folder which is resource_type: "auto"
                    // deleteFromCloudinary handles resourceType. 'auto' matches 'image' usually in destroy API unless specified.
                    // If it was uploaded as 'auto', it might be easier to use 'image' or check the file extension.
                    
                    try {
                        await deleteFromR2(msg.fileUrl);
                    } catch (e) {
                        console.error("Cleanup mentorship cloudinary error:", e);
                    }
                }
                await MentorshipMessage.findByIdAndDelete(msg._id);
            }
            
            if (expiredMessages.length > 0) {
                console.log(`Cleaned up ${expiredMessages.length} expired mentorship messages.`);
            }
        } catch (error) {
            console.error("Error in mentorship chat cleanup cron:", error);
        }
    });
};
