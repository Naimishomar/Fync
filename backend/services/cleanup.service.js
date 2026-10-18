import cron from 'node-cron';
import ClubMessage from '../models/club/clubMessage.model.js';
import { deleteFromR2 } from '../utils/r2.js';
import { runNightlyScoreUpdate } from './nightlyScore.service.js';
import InterviewSession from '../models/interview.model.js';

/**
 * Interview sessions are deleted when the student ends or cancels. One still
 * here a day later was abandoned mid-call (app killed): it holds the resume
 * text and transcript, and its audio/resume files sit in R2 for nothing.
 * Sessions last at most 15 minutes, so a day is far past any live one.
 */
export const purgeAbandonedInterviews = async () => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stale = await InterviewSession.find({ createdAt: { $lt: cutoff } })
        .select('resumePublicId audioPublicIds')
        .lean();
    if (!stale.length) return 0;
    await Promise.allSettled(
        stale.flatMap((s) => [...(s.audioPublicIds || []), s.resumePublicId].filter(Boolean).map((u) => deleteFromR2(u)))
    );
    await InterviewSession.deleteMany({ _id: { $in: stale.map((s) => s._id) } });
    console.log(`🧹 Purged ${stale.length} abandoned interview sessions`);
    return stale.length;
};

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

            // Only messages carrying a file need an R2 delete. (This used to read
            // `mediaUrl`/`messageType`, which ClubMessage does not have, so no
            // club file was ever removed from R2.)
            const expiredMessages = await ClubMessage.find({
                createdAt: { $lt: thirtyDaysAgo },
                fileUrl: { $nin: [null, ''] },
            }).select('fileUrl').lean();

            await Promise.allSettled(expiredMessages.map((msg) => deleteFromR2(msg.fileUrl)));

            const result = await ClubMessage.deleteMany({ createdAt: { $lt: thirtyDaysAgo } });
            if (result.deletedCount) console.log(`✅ Purged ${result.deletedCount} club messages.`);
        } catch (error) {
            console.error("Cleanup cron failed:", error.message);
        }
    });

    cron.schedule('30 0 * * *', () => {
        purgeAbandonedInterviews().catch((err) => console.error('Interview cleanup error:', err.message));
    });

    // ─── Nightly Fync Score + GitHub Sync — 2:00 AM IST (20:30 UTC) ──────────
    cron.schedule('30 20 * * *', async () => {
        await runNightlyScoreUpdate();
    });
};

export default startCleanupCron;
