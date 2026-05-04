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

            if (expiredMessages.length > 0) {
                console.log(`🧹 Processing ${expiredMessages.length} expired club records...`);
                
                const deletions = expiredMessages
                    .filter(msg => msg.mediaUrl)
                    .map(msg => {
                        const fileName = msg.mediaUrl.split('/').pop();
                        let folder = 'clubs/media';
                        if (msg.messageType === 'image') folder = 'clubs/images';
                        else if (msg.messageType === 'video') folder = 'clubs/videos';
                        else if (msg.messageType === 'file') folder = 'clubs/files';
                        return deleteFromR2(folder, fileName).catch(e => console.error(`Failed to delete media: ${msg.mediaUrl}`, e.message));
                    });
                
                await Promise.allSettled(deletions);

                const result = await ClubMessage.deleteMany({
                    createdAt: { $lt: thirtyDaysAgo }
                });

                console.log(`✅ Successfully purged ${result.deletedCount} messages from database.`);
            }
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
