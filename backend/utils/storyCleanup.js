import cron from "node-cron";
import Story from "../models/story.model.js";
import { deleteFromR2 } from "./r2.js";

/** Every 10 minutes: delete stories past their 24h, and their R2 media. */
export const sweepExpiredStories = async () => {
    const expired = await Story.find({ expiresAt: { $lte: new Date() } }).select("_id image video").lean();
    if (!expired.length) return 0;
    await Promise.allSettled(expired.flatMap((s) => [s.image, s.video]).filter(Boolean).map(deleteFromR2));
    const { deletedCount } = await Story.deleteMany({ _id: { $in: expired.map((s) => s._id) } });
    return deletedCount;
};

export const initStoryCleanup = () => {
    cron.schedule("*/10 * * * *", async () => {
        try {
            const n = await sweepExpiredStories();
            if (n) console.log(`🧹 Story cleanup: removed ${n} expired stories`);
        } catch (error) {
            console.error("❌ Story cleanup failed:", error.message);
        }
    });
};
