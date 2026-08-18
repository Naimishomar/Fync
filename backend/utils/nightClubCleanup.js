import cron from "node-cron";
import redisClient from "./redis.js";
import { deleteFromR2 } from "./r2.js";
import { CLUB_TIMEZONE, CLUB_CLOSE_HOUR } from "./nightClub.js";

// Runs at 06:00 IST — the moment the club shuts — every day.
//
// node-cron schedules in the server's local timezone unless told otherwise, and
// nothing sets TZ (node:20-slim is UTC), so "0 6 * * *" fired at 11:30 IST:
// five and a half hours of "what happens here stays here" that stayed.
export const initNightClubCleanup = () => {
    cron.schedule(`0 ${CLUB_CLOSE_HOUR} * * *`, async () => {
        try {
            console.log("☀️ 6:00 AM IST: Sunrise. Wiping 12AM Club memories...");

            if (!redisClient.isReady) {
                // The image list lives in Redis, so without it there is no way to
                // know what to delete from R2. Say so loudly — silently skipping
                // leaves orphaned images in the bucket.
                console.error("12AM Cleanup: Redis unavailable, night data NOT wiped. Will retry tomorrow.");
                return;
            }

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
    }, { timezone: CLUB_TIMEZONE });
};
