import cron from "node-cron";
import Stay from "../models/stay.model.js";
import { dropPhotos } from "../controllers/stay.controller.js";

const BATCH = 200;

/** Delete expired PG/roommate listings and their R2 photos, a bounded batch per run. */
export const sweepExpiredStays = async () => {
    const expired = await Stay.find({ expiresAt: { $lte: new Date() } }).select("_id photos").sort({ expiresAt: 1 }).limit(BATCH).lean();
    if (!expired.length) return 0;
    await dropPhotos(expired.flatMap((s) => s.photos || []));
    const { deletedCount } = await Stay.deleteMany({ _id: { $in: expired.map((s) => s._id) } });
    return deletedCount;
};

export const initStayCleanup = () => {
    cron.schedule("7 * * * *", async () => {
        try {
            const n = await sweepExpiredStays();
            if (n) console.log(`🧹 Stay cleanup: removed ${n} expired listings`);
        } catch (error) {
            console.error("❌ Stay cleanup failed:", error.message);
        }
    }, { timezone: "Asia/Kolkata" });
};
