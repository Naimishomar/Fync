import cron from 'node-cron';
import Bootcamp from '../models/events/bootcamp.model.js';
import SpeakerSession from '../models/events/createSpeakerSession.model.js';
import RegisterBootcamp from '../models/events/registerBootcamp.model.js';
import RegisterSpeakerSession from '../models/events/registerSpeakerSession.model.js';
import EventMessage from '../models/events/eventMessage.model.js';

export const initEventCleanup = () => {
    // Run every day at midnight
    cron.schedule('0 0 * * *', async () => {
        console.log('🧹 Running Event Data Cleanup...');
        try {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            // 1. Cleanup Bootcamps
            const expiredBootcamps = await Bootcamp.find({ endDate: { $lt: sevenDaysAgo } });
            for (const bc of expiredBootcamps) {
                console.log(`🗑️ Cleaning up Bootcamp: ${bc.eventName}`);
                await EventMessage.deleteMany({ eventId: bc._id, eventModel: 'Bootcamp' });
                await RegisterBootcamp.deleteMany({ eventId: bc._id });
                // We keep the bootcamp record itself but its "active community" and "attendee details" are wiped
                bc.isCommunityActive = false;
                await bc.save();
            }

            // 2. Cleanup Speaker Sessions
            const expiredSpeakerSessions = await SpeakerSession.find({ date: { $lt: sevenDaysAgo } });
            for (const ss of expiredSpeakerSessions) {
                console.log(`🗑️ Cleaning up Speaker Session: ${ss.eventName}`);
                await EventMessage.deleteMany({ eventId: ss._id, eventModel: 'SpeakerSession' });
                await RegisterSpeakerSession.deleteMany({ eventId: ss._id });
                ss.isCommunityActive = false;
                await ss.save();
            }

            console.log('✅ Event Data Cleanup Completed');
        } catch (error) {
            console.error('❌ Error in Event Cleanup Job:', error);
        }
    });
};
