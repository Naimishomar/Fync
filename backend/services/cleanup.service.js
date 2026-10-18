import cron from 'node-cron';
import ClubMessage from '../models/club/clubMessage.model.js';
import { deleteFromR2 } from '../utils/r2.js';
import { runNightlyScoreUpdate } from './nightlyScore.service.js';
import InterviewSession from '../models/interview.model.js';
import CodingSubmission from '../models/coding/codingSubmission.model.js';
import OLX from '../models/olx.model.js';
import LostAndFound from '../models/lostAndFound.model.js';

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

const DAY = 24 * 60 * 60 * 1000;
const ago = (ms) => new Date(Date.now() - ms);

/** Only Accepted code is ever worth keeping; nothing reads failed attempts' code. */
export const stripFailedSubmissionCode = async () => {
    const r = await CodingSubmission.updateMany(
        { status: { $ne: 'Accepted' }, createdAt: { $lt: ago(7 * DAY) }, code: { $exists: true } },
        { $unset: { code: 1, errorOutput: 1 } }
    );
    if (r.modifiedCount) console.log(`🧹 Stripped code from ${r.modifiedCount} failed submissions`);
    return r.modifiedCount;
};

/**
 * Campus listings, classified-ad style: sold OLX items go 7 days after the
 * sale, unsold ones after 30; Lost & Found goes 12h after a claim (the 24h
 * claimed_at TTL is only a backstop) or after 30 days. Done here rather than
 * by TTL so the photos are removed from R2 too, not orphaned.
 */
export const purgeStaleListings = async () => {
    const jobs = [
        [OLX, { $or: [{ is_selled: true, updatedAt: { $lt: ago(7 * DAY) } }, { createdAt: { $lt: ago(30 * DAY) } }] }, (d) => d.product_image || []],
        [LostAndFound, { $or: [{ claimed_at: { $lt: ago(DAY / 2) } }, { createdAt: { $lt: ago(30 * DAY) } }] }, (d) => [d.image]],
    ];
    let total = 0;
    for (const [Model, filter, files] of jobs) {
        const stale = await Model.find(filter).select('product_image image').limit(500).lean();
        if (!stale.length) continue;
        await Promise.allSettled(stale.flatMap(files).filter(Boolean).map((u) => deleteFromR2(u)));
        const r = await Model.deleteMany({ _id: { $in: stale.map((d) => d._id) } });
        total += r.deletedCount;
    }
    if (total) console.log(`🧹 Purged ${total} stale campus listings`);
    return total;
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

    cron.schedule('45 0 * * *', () => {
        stripFailedSubmissionCode().catch((err) => console.error('Submission cleanup error:', err.message));
    });

    // Hourly: claimed Lost & Found items must be caught before their 24h TTL.
    cron.schedule('7 * * * *', () => {
        purgeStaleListings().catch((err) => console.error('Listing cleanup error:', err.message));
    });

    // ─── Nightly Fync Score + GitHub Sync — 2:00 AM IST (20:30 UTC) ──────────
    cron.schedule('30 20 * * *', async () => {
        await runNightlyScoreUpdate();
    });
};

export default startCleanupCron;
