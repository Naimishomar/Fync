import Announcement from "../../models/hackathon/announcements.model.js";
import Hackathon from "../../models/hackathon/hackathons.model.js";
import User from "../../models/user.model.js";
import Notification from "../../models/notification.model.js";
import { sendPushNotification } from "../../utils/notification.js";

// GET /announcements/:hackathonId
export const getannouncements = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, type } = req.query;
        const filter = { hackathon: req.params.hackathonId };
        if (type) filter.type = type;
        const skip = (Number(page) - 1) * Number(limit);

        const announcements = await Announcement.find(filter)
            .populate("author", "name avatar role")
            .sort({ isPinned: -1, createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .lean();

        res.status(200).json({ success: true, announcements });
    } catch (error) {
        next(error);
    }
};

// POST /announcements/:hackathonId
export const postAnnouncements = async (req, res, next) => {
    try {
        const hack = await Hackathon.findById(req.params.hackathonId);
        if (!hack) {
            return res.status(404).json({ success: false, message: "Hackathon not found" });
        }

        // Only organiser or assigned judges can post
        const isOrganiser = hack.organiser.toString() === req.user.id.toString();
        const isJudge = hack.judges.map(String).includes(req.user.id.toString());
        if (!isOrganiser && !isJudge) {
            return res.status(403).json({ success: false, message: "Not authorised to post announcements" });
        }

        const { title, body, type, isPinned } = req.body;
        const announcement = await Announcement.create({
            hackathon: req.params.hackathonId,
            author: req.user.id,
            Title: title,   // model field is 'Title' (capital T)
            body,
            type: type || "general",
            isPinned: isPinned || false,
        });

        await announcement.populate("author", "role name avatar");

        // Broadcast to hackathon socket room
        const io = req.app.get("io");
        if (io) {
            io.to(`hack:${hack._id}`).emit("announcement:new", announcement);
        }

        // 🔔 Notify all participants
        const participants = hack.participants || [];
        if (participants.length > 0) {
            // Process notifications in background
            (async () => {
                try {
                    const participantDocs = await User.find({ _id: { $in: participants } }).select("expoPushToken");
                    
                    for (const participant of participantDocs) {
                        // Skip if author
                        if (participant._id.toString() === req.user.id.toString()) continue;

                        // Create in-app notification
                        await Notification.create({
                            recipient: participant._id,
                            sender: req.user.id,
                            type: 'hackathon_announcement',
                            message: `New Signal: ${title || "Important update from organiser"}`,
                            hackathon: hack._id
                        });

                        // Send push notification
                        if (participant.expoPushToken) {
                            sendPushNotification(
                                participant.expoPushToken,
                                `📡 ${hack.title}: NEW SIGNAL`,
                                body.substring(0, 100) + (body.length > 100 ? "..." : ""),
                                { hackathonId: hack._id, type: 'announcement' }
                            ).catch(() => {});
                        }
                    }
                } catch (err) {
                    console.error("Broadcast Notification Error:", err);
                }
            })();
        }

        return res.status(200).json({ success: true, message: "Announcement sent", announcement });
    } catch (error) {
        next(error);
    }
};

// PATCH /announcements/:announcementId/react
export const reactToAnnouncement = async (req, res, next) => {
    try {
        const { emoji } = req.body;
        const ann = await Announcement.findById(req.params.announcementId);
        if (!ann) return res.status(404).json({ success: false, message: "Announcement not found" });

        // Remove old reaction from this user if exists
        ann.reactions = ann.reactions.filter(r => r.user.toString() !== req.user.id.toString());
        // Add new one
        ann.reactions.push({ user: req.user.id, emoji });
        await ann.save();

        const io = req.app.get("io");
        if (io) {
            io.to(`hack:${ann.hackathon}`).emit("announcement:reaction", {
                announcementId: ann._id,
                userId: req.user.id,
                emoji
            });
        }

        res.status(200).json({ success: true, reactions: ann.reactions });
    } catch (error) {
        next(error);
    }
};

// PATCH /announcements/:announcementId/pin
export const pinAnnouncement = async (req, res, next) => {
    try {
        const { isPinned } = req.body;
        const ann = await Announcement.findById(req.params.announcementId).populate("hackathon", "organiser");
        if (!ann) return res.status(404).json({ success: false, message: "Announcement not found" });

        // Check if user is organiser of that hackathon
        // FIX: ann.hackathon is now a populated doc — read .organiser from it, not a new findById(doc)
        const organiserId = ann.hackathon?.organiser?._id || ann.hackathon?.organiser;
        if (!organiserId || String(organiserId) !== String(req.user.id)) {
            return res.status(403).json({ success: false, message: "Only organiser can pin" });
        }

        ann.isPinned = isPinned;
        await ann.save();

        const io = req.app.get("io");
        if (io) {
            io.to(`hack:${ann.hackathon._id}`).emit("announcement:pinned", {
                announcementId: ann._id,
                isPinned
            });
        }

        res.status(200).json({ success: true, isPinned: ann.isPinned });
    } catch (error) {
        next(error);
    }
};

// POST /announcements/:announcementId/read
export const markAnnouncementRead = async (req, res, next) => {
    try {
        const ann = await Announcement.findById(req.params.announcementId);
        if (!ann) return res.status(404).json({ success: false, message: "Announcement not found" });

        if (!ann.readby.some(id => String(id) === String(req.user.id))) {
            ann.readby.push(req.user.id);
            await ann.save();
        }

        res.status(200).json({ success: true });
    } catch (error) {
        next(error);
    }
};
