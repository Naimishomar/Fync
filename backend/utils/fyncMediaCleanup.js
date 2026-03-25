import cron from "node-cron";
import FyncMedia from "../models/fync media/fyncMedia.model.js";
import Comment from "../models/comment.model.js";
import { deleteFromCloudinary } from "./cloudinary.js";

/**
 * Cleanup Fync Media and Cloudinary assets older than 30 days
 * Runs every day at midnight
 */
export const initFyncMediaCleanup = () => {
    // cron.schedule("0 0 * * *", async () => { // Midnight every day
    // For manual testing or more frequent runs, use: "0 * * * *" (every hour)
    cron.schedule("0 0 * * *", async () => {
        try {
            console.log("🔹 Running Fync Media cleanup job...");
            
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            // Find media posted before 30 days ago
            const expiredMedia = await FyncMedia.find({ createdAt: { $lt: thirtyDaysAgo } });

            if (expiredMedia.length > 0) {
                console.log(`🧹 Found ${expiredMedia.length} expired Fync Media posts to clean.`);
                
                for (let media of expiredMedia) {
                    try {
                        // 1. Delete Video from Cloudinary
                        if (media.video_link) {
                            await deleteFromCloudinary(media.video_link, "video");
                        }
                        
                        // 2. Delete Thumbnail from Cloudinary
                        if (media.thumbnail) {
                            await deleteFromCloudinary(media.thumbnail, "image");
                        }

                        // 3. Delete Associated Comments
                        await Comment.deleteMany({ post: media._id, postType: "FyncMedia" });

                        // 4. Delete Media Document
                        await FyncMedia.findByIdAndDelete(media._id);
                        
                        // console.log(`✅ Deleted expired media: ${media.title}`);
                    } catch (e) {
                        console.error(`❌ Error cleaning up media item ${media._id}:`, e.message);
                    }
                }
                console.log(`✅ Cleaned up ${expiredMedia.length} expired Fync Media documents.`);
            } else {
                // console.log("✨ No expired Fync Media found today.");
            }
        } catch (error) {
            console.error("❌ Error in Fync Media cleanup cron:", error);
        }
    });
};
