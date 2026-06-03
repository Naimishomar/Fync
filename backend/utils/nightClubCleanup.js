import cron from "node-cron";
import redisClient from "./redis.js";
import { deleteFromR2 } from "./r2.js";

// Run exactly at 6:00 AM every day to wipe Night Club data
export const initNightClubCleanup = () => {
    cron.schedule("0 6 * * *", async () => {
        try {
            console.log("☀️ 6:00 AM: Sunrise. Wiping 12AM Club memories...");

            // 1. Fetch all image URLs sent during the night
            const imageUrls = await redisClient.lRange("night_club:images", 0, -1);
            
            if (imageUrls && imageUrls.length > 0) {
                console.log(`🌙 12AM Club: Deleting ${imageUrls.length} images from R2 storage...`);
                
                // 2. Delete from R2 storage
                const deletions = imageUrls.map(url => 
                    deleteFromR2(url).catch(e => console.error("R2 cleanup error (12AM Club):", e.message))
                );
                
                await Promise.allSettled(deletions);
            }

            // 3. Completely wipe Redis Memory
            await redisClient.del("night_club:history");
            await redisClient.del("night_club:images");

            console.log("☀️ 12AM Club: Daily sunrise wipe completed successfully. Memory erased.");

        } catch (error) {
            console.error("12AM Cleanup error:", error);
        }
    });
};
