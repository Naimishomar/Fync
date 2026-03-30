import cron from "node-cron";
import FyncMedia from "../models/fync media/fyncMedia.model.js";
import Comment from "../models/comment.model.js";
import { deleteFromR2 } from "./r2.js";

export const initFyncMediaCleanup = () => {
    cron.schedule("0 0 * * *", async () => {
        try {
            console.log("🔹 Running Fync Media cleanup job...");
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const expiredMedia = await FyncMedia.find({ createdAt: { $lt: thirtyDaysAgo } });

            if (expiredMedia.length > 0) {
                console.log(`🧹 Found ${expiredMedia.length} expired Fync Media posts to clean.`);
                for (let media of expiredMedia) {
                    try {
                        if (media.video_link) {
                            await deleteFromR2(media.video_link);
                        }
                        if (media.thumbnail) {
                            await deleteFromR2(media.thumbnail);
                        }
                        await Comment.deleteMany({ post: media._id, postType: "FyncMedia" });
                        await FyncMedia.findByIdAndDelete(media._id);
                    } catch (e) {
                        console.error(`❌ Error cleaning up media item ${media._id}:`, e.message);
                    }
                }
                console.log(`✅ Cleaned up ${expiredMedia.length} expired Fync Media documents.`);
            } else {
                console.log("✨ No expired Fync Media found today.");
            }
        } catch (error) {
            console.error("❌ Error in Fync Media cleanup cron:", error);
        }
    });
};
