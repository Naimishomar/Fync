import cron from 'node-cron';
import ClubMessage from '../models/club/clubMessage.model.js';
import { deleteFromR2 } from '../utils/r2.js';
import { runNightlyScoreUpdate } from './nightlyScore.service.js';

/**
 * Cleanup Task: Purge messages and media older than 30 days.
 * Runs daily at midnight.
 */
const startCleanupCron = () => {
    cron.schedule('0 0 * * *', async () => {
        console.log("🧹 Starting 30-day automated cleanup...");
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            // Find messages with media that are older than 30 days
            const expiredMessages = await ClubMessage.find({
                createdAt: { $lt: thirtyDaysAgo }
            });

            console.log(`Found ${expiredMessages.length} expired records.`);

            for (const msg of expiredMessages) {
                // If message has media, delete from R2
                if (msg.mediaUrl) {
                    try {
                        const fileName = msg.mediaUrl.split('/').pop();
                        let folder = 'clubs/media';
                        if (msg.messageType === 'image') folder = 'clubs/images';
                        else if (msg.messageType === 'video') folder = 'clubs/videos';
                        else if (msg.messageType === 'file') folder = 'clubs/files';
                        
                        await deleteFromR2(folder, fileName);
                    } catch (err) {
                        console.error(`Failed to delete media for message ${msg._id}:`, err.message);
                    }
                }
            }

            // Purge from DB
            const result = await ClubMessage.deleteMany({
                createdAt: { $lt: thirtyDaysAgo }
            });

            console.log(`Successfully purged ${result.deletedCount} messages from database.`);
        } catch (error) {
            console.error("Cleanup cron failed:", error.message);
        }
    });

    // ─── Nightly Fync Score + GitHub Sync — 2:00 AM IST (20:30 UTC) ──────────
    cron.schedule('30 20 * * *', async () => {
        await runNightlyScoreUpdate();
    });
};

export default startCleanupCron;
