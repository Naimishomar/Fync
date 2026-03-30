import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { upload } from '../../utils/r2.js';
import { r2UploadMiddleware } from '../../utils/r2Upload.js';
import * as BootcampController from "../../controllers/speakers/bootcamp.controller.js";
const { getBootcampById } = BootcampController; // Also possible BootcampController.getBootcampById

const router = express.Router();

router.post("/create", authMiddleware, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), r2UploadMiddleware({ logo: 'bootcamp_events', banner: 'bootcamp_events' }), BootcampController.createBootcamp);
router.get("/all", authMiddleware, BootcampController.getAllBootcamps);
router.post("/register", authMiddleware, BootcampController.registerBootcamp);
router.post("/attendance", authMiddleware, BootcampController.markBootcampAttendance);
router.get("/registrations/:eventId", authMiddleware, BootcampController.getBootcampRegistrations);
router.get("/my-registrations", authMiddleware, BootcampController.getMyBootcampRegistrations);
router.put("/update", authMiddleware, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), r2UploadMiddleware({ logo: 'bootcamp_events', banner: 'bootcamp_events' }), BootcampController.updateBootcamp);
router.delete("/delete", authMiddleware, BootcampController.deleteBootcamp);
router.delete("/registrations/cancel/:id", authMiddleware, BootcampController.cancelBootcampRegistration);

// Admin & Community
import * as Interaction from "../../controllers/events/eventActivity.controller.js";
router.post("/admin/add", authMiddleware, Interaction.addSecondaryAdmin);
router.post("/admin/remove", authMiddleware, Interaction.removeSecondaryAdmin);
router.get("/community/:type/:eventId", authMiddleware, Interaction.getEventMessages);
router.post("/community/send", authMiddleware, upload.single('image'), r2UploadMiddleware({ __single__: 'event_community' }), Interaction.sendEventMessage);
router.delete("/community/message/:messageId", authMiddleware, Interaction.deleteEventMessage);
router.get("/:id", authMiddleware, BootcampController.getBootcampById);

export default router;
