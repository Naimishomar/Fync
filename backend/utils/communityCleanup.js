import cron from 'node-cron';
import CommunityMessage from '../models/community/communityMessage.model.js';
import { deleteFromR2 } from './r2.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export const initCommunityCleanup = () => {
    // The 30-day TTL index deletes the documents; this deletes their R2 files
    // first. It used to look for messages older than 30 days -- which the TTL had
    // usually already removed, so their files leaked -- and ran on a setInterval
    // that every deploy reset. Now: a fixed daily slot (staggered with the other
    // nightly sweeps) for messages past 29 days, i.e. in their last day.
    cron.schedule('25 0 * * *', async () => {
        try {
            const cutoff = new Date(Date.now() - 29 * DAY_MS);
            const expiring = await CommunityMessage.find({
                createdAt: { $lt: cutoff },
                $or: [{ image: { $nin: [null, ''] } }, { video: { $nin: [null, ''] } }],
            }).select('image video').lean();

            await Promise.allSettled(expiring.flatMap((msg) =>
                [msg.image, msg.video].filter(Boolean).map((url) =>
                    deleteFromR2(url).catch((e) => console.error('R2 delete error (community):', e.message)))));

            if (expiring.length) console.log(`✅ Cleaned up media for ${expiring.length} expiring Echo Hub messages.`);
        } catch (error) {
            console.error('Community cleanup error:', error);
        }
    });
};
