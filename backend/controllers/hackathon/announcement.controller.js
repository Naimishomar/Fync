import Announcement from "../../models/hackathon/announcements.model.js";
import Hackathon from "../../models/hackathon/hackathons.model.js";

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
            .limit(Number(limit));

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

        return res.status(200).json({ success: true, message: "Announcement sent", announcement });
    } catch (error) {
        next(error);
    }
};
