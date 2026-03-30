import express from 'express';
import { createSpeakerSession, getAllSpeakerSession, getCollegeSpeakerSession, registerSpeakerSession, updateSpeakerSession, getUserSpeakerSessions, addSpeakerToSession, updateSpeaker, deleteSpeakerSession, deleteSpeaker, getEventRegistrations, markAttendance, getSpeakerSessionById, deleteRegistration } from '../../controllers/speakers/speaker.controller.js';
import {authMiddleware} from '../../middlewares/auth.middleware.js';
import { upload } from '../../utils/r2.js';
import { r2UploadMiddleware } from '../../utils/r2Upload.js';

const router = express.Router();

router.post('/create', authMiddleware, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), r2UploadMiddleware({ logo: 'speaker_events', banner: 'speaker_events' }), createSpeakerSession);
router.get('/all', authMiddleware, getAllSpeakerSession);
router.get('/college/:college', authMiddleware, getCollegeSpeakerSession);
router.post('/register', authMiddleware, registerSpeakerSession);
router.delete('/register/:id', authMiddleware, deleteRegistration);
router.get('/my-sessions', authMiddleware, getUserSpeakerSessions);
router.post('/add-speaker', authMiddleware, upload.single('image'), r2UploadMiddleware({ __single__: 'speaker_events' }), addSpeakerToSession);
router.put('/update-speaker', authMiddleware, upload.single('image'), r2UploadMiddleware({ __single__: 'speaker_events' }), updateSpeaker);
router.put('/update', authMiddleware, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), r2UploadMiddleware({ logo: 'speaker_events', banner: 'speaker_events' }), updateSpeakerSession);   
router.post('/delete-session', authMiddleware, deleteSpeakerSession);
router.post('/delete-speaker', authMiddleware, deleteSpeaker);
router.get('/registrations/:eventId', authMiddleware, getEventRegistrations);
router.post('/mark-attendance', authMiddleware, markAttendance);

// Admin & Community
import * as Interaction from "../../controllers/events/eventActivity.controller.js";
router.post("/admin/add", authMiddleware, Interaction.addSecondaryAdmin);
router.post("/admin/remove", authMiddleware, Interaction.removeSecondaryAdmin);
router.get("/community/:type/:eventId", authMiddleware, Interaction.getEventMessages);
router.post("/community/send", authMiddleware, upload.single('image'), r2UploadMiddleware({ __single__: 'event_community' }), Interaction.sendEventMessage);
router.delete("/community/message/:messageId", authMiddleware, Interaction.deleteEventMessage);
router.get("/:id", authMiddleware, getSpeakerSessionById);

export default router;