import cron from "node-cron";
import AlumniMessage from "../models/alumniMessage.model.js";
import { deleteFromCloudinary } from "./cloudinary.js";

// Run every hour to delete expired messages
export const initAlumniChatCleanup = () => {
    cron.schedule("0 * * * *", async () => {
        try {
            console.log("Running alumni chat cleanup job...");
            const now = new Date();
            const expiredMessages = await AlumniMessage.find({ expiresAt: { $lt: now } });

            for (let msg of expiredMessages) {
                if (msg.fileUrl && msg.messageType !== 'text') {
                    let resourceType = 'image';
                    if (msg.messageType === 'file') resourceType = 'raw';
                    // Check if it's potentially a video or voice if those types are added later
                    
                    try {
                        await deleteFromCloudinary(msg.fileUrl, resourceType);
                    } catch (e) {
                        console.error("Alumni cleanup cloudinary error:", e);
                    }
                }
                await AlumniMessage.findByIdAndDelete(msg._id);
            }
            if (expiredMessages.length > 0) {
                console.log(`Cleaned up ${expiredMessages.length} expired alumni chat messages.`);
            }
        } catch (error) {
            console.error("Error in alumni chat cleanup cron:", error);
        }
    });
};
