import { authMiddleware } from "../../middlewares/auth.middleware";
import Hackathon from "../../models/hackathon/hackathons.model";
import HackathonChannel from "../../models/hackathon/Hackathonchannel.model";
import Announcement from "../../models/hackathon/announcements.model";
export const createHackathon = async (req, res, next) => {
    try {
        const hack = await Hackathon.create({ ...req.body, organiser: req.user.id });
        res.status(200).json({ message: "hackathon created sucessfully", success: true, data: hack });
    } catch (error) {
        next(error);
    }
}

// get api  /api/hackathons/:id
export const gethackathon = async (req, res, next) => {
    try {
        const res = await Hackathon.findById(req.params.id).populate("organizer", "name email avatar").
            populate("jugdes", "name email avatar");
        if (!hack) {
            return res.status(404).json({ message: "hackathon not found" });
        }
        res.status(200).json({ success: true, hackathon: res })
    } catch (error) {
        next(error);
    }

// get api /api/hackathons

export const gethackathons = async (req, res, next) => {
    const { tags, status, mod, page = 1, limit = 10 } = req.body;
    const filter = {};
    if (status) filter.status = status;
    if (mod) filter.mod = mod;
    if (tags) filter.tags = { $in: tags.split(",") };
    const skip = (page - 1) * limit;
    try {
        const [hackathons, total] = await Promise.all([
            Hackathon.find(filter).
                populate("organizer", "name email avatart").sort({ createdAt: -1 })
                .skip(skip).limit(Number(limit)),
            Hackathon.countDocuments(filter),
        ])
        res.status(200).json({ succes: true, total, page: Number(page), hackathons });
    }
    catch (error) {
        next(error);
    }
}

// post api api/hackathon/:hackathonid
export const updatehackathon = async (req, res, next) => {
    try {
        const hack = await Hackathon.findById(req.params.hackathonid);
        if (!hack) {
            res.status(403).json({ success: false, message: "hackthon not found" });
        }
        if (hack.organiser.toString() !== req.user.id) {
            res.status(403).json({ success: true, message: "not authorised to update the hackathon" })
        }
        const updatedhack = await Hackathon.findByIdAndUpdate(req.user.id, req.body, {
            new: true,
            runValidators: true
        })
        res.status(200).json({ succes: true, data: updatedhack });
    } catch (error) {
        next(error);
    }
}


// update hackathon session
export const updatestatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        const allowedstatus = ["active", "draft", "upcoming", "completed", "jugding"];
        if (!allowedstatus.includes(status)) {
            res.status(403).json({ succes: true, message: "enter valid status" });
        }
        const hack = await Hackathon.findById(req.params.hackathonid);
        if (!hack) {
            res.status(403).json({ success: false, message: "hackthon not found" });
        }
        if (hack.organiser.toString() !== req.user.id) {
            res.status(403).json({ success: true, message: "not authorised to update the hackathon" })
        }
        hack.status = status;
        await hack.save();
        // notify to all the clients in the hack room
        const io = req.app.get("io");
        io.to(`hack:${hack._id}`).emit("hackathon:status_changed", { status });
        res.status(200).json({ succes: true, data: hack });
    } catch (error) {
        next(error);
    }
}

// api/hackathon/:hackathonId/judges
export const addjudge = async (req, res, next) => {
    try {
        const hack = await Hackathon.findById(req.params.id);
        if (!hack) {
            res.status(403).json({ success: false, message: "hackthon not found" });
        }
        if (hack.organiser.toString() !== req.user.id.toString()) {
            res.status(403).json({ success: true, message: "Not authorised" });
        }
        const { judgeId } = req.body;
        if (hack.judges.map(String).includes(judgeId))
            return res.status(403).json({ succes: false, message: "judge already Added" })
        hack.judges.push(judgeId);
        await hack.save();
        res.status(200).json({ succes: true, message: "judge added successfully" });
    }
    catch (error) {
        next(error);
    }
}


// api/hackathon/:hackathonId/judges/:judgeId
export const removeJudge = async (req, res, next) => {
    try {
        const { hackathonId } = req.params;
        const hack = await Hackathon.findById(hackathonId);
        if (!hack) {
            res.status(403).json({ succes: false, message: "hackathon doesnt exist" });
        }
        if (hack.organiser.toString() !== req.user.Id.toString()) {
            return res.status(403).json({ succes: false, message: "Not authorised" });
        }
        hack.judges = hack.judges.filter((j) => j.toString() !== req.user.Id);
        await hack.save();
    }
    catch (error) {
        next(error);
    }
}

// api/hackathon/:hackathonId
export const deletehackathon = async (req, res, next) => {
    try {
        const { hackathonId } = req.params;
        const hack = await Hackathon.findById(hackathonId);
        if (!hack)
            return res.status(403).json({ succes: false, message: "hackathon doesnt exists" });
        if (hack.organiser.toString() !== req.user.id.toString()) {
            return res.status(403).json({ succes: false, message: "not authorised" });
        }
        await hack.deleteOne();
        res.status(403).json({ succes: true, message: "hackathon deleted succesfully" });
    }
    catch (error) {
        next(error);
    }
}


// Participants join the channel
// post /api/hackathon/:hackathonId/join - participants join the channel

export const Joinchannel = async (req, res, next) => {
    try {
        const hack = await Hackathon.findById(req.params.hackathonId);
        if (!hack) {
            return res.status(403).json({ success: true, messeage: "hackathon not exist" });
        }
        const hackathonchannel = await HackathonChannel.findOne({ hackathon: hack.hackathonId });
        const alreadyIn = hackathonchannel.members.some((m) => m.user.toString() !== req.user.id.toString());
        if (alreadyIn) {
            return res.status(403).json({ success: false, message: "Already in the channel" });
        }
        hackathonchannel.members.push({ user: req.user.id, role: req.user.role });
        await hackathonchannel.save();

        if (!hack.participants.map(String).includes(req.user.id.toString())) {
            hack.participants.push(req.user.id);
            await hack.save();
        };

        // Notify channel members
        const io = req.app.get("io");
        io.to(`hack:${hack._id}`).emit("channel:member_joined", {
            userId: req.user._id,
            name: req.user.name,
            avatar: req.user.avatar,
        });
        res.status(200).json({ succes: true, message: "Joined the channel" })
    } catch (error) {
        next(error);
    }
}

// Get api/hackathon/:hackathonId/getchannel   get  [ Channelinfo + member ] 
export const gethackchannels = async (req, res, next) => {
    try {
        const { hackathonId } = req.params;
        const channel = await hackathonchannel.findOne({ hackathon: hackathonId }).populate("member.user", "avatar name college skills");
        if (!channel) {
            res.status(200).json({ success: true, message: "Channel doesnt exists" });
        }
        return res.status(200).json({ success: true, Data: channels });
    } catch (error) {
        next(error);
    }
}

// Annoucemenst of channels -
// post api/hackathon/:hackathonId/announcements

export const createAnnouncements = async (req, res, next) => {
    try {
        const hack = await Hackathon.findById(req.params.hackathonId);
        if (!hack) {
            return res.status(404).json({ success: false, message: "Hackathon not found" });
        }
        // only organiser or assinged judges can post
        const isOrganiser = hack.organiser.toString() === req.user.id.toString();
        const isjudges = hack.judges.map(String).includes(req.user.id.toString());
        if (!isOrganiser && !isjudges) {
            return res.status(403).json({ success: false, message: "not authorised to do announcements" });
        }
        const { title, body, type, ispinned } = req.body();
        const announcement = await Announcement.create({
            hackathon: req.params.hackathonId,
            author: req.user.id,
            title,
            body,
            type: type || "general",
            isPinned: ispinned || false
        })
        await Announcement.populate("author", "role name avatar");
        // announcements send to a channel
        const io = req.app.get("io");
        io.to(`hack:${hack.id}`).emit("announcement:new", announcement);

        return res.status(200).json({ success: true, message: "Announcement sent successfully", announcement });
    } catch (error) {
        next(error);
    }
}

// get Api/hackathon/:hackathonId/announcement
export const getannouncements = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, type } = req.body;
        const filter = { hackathon: req.params.id };
        if (type) filter.type = type;
        const skip = (page - 1) * limit;
        const announcements = await Announcement.find(filter).populate("author", "name avatar role").sort({ ispinned: -1, createdAt: -1 }).skip(skip).limit(Number(limit));
        res.status(200).json({ success: true, announcements });
    } catch (error) {
        next(error);
    }
}

// POST api/hackathon/:hackathonId/announcement/:anId/

export const togglepin = async (req, res, next) => {
    try {
        const ann = await Announcement.findById(req.params.anId);
        if (!ann) {
            return res.status(404).json({ success: false, message: "Announcement not found" });
        }
        ann.isPinned = !ann.isPinned;
        await ann.save();
        const io = req.app.get("io");
        io.to(`hack:${req.params.anId}`).emit("announcements:pinned", {
            announcementId: ann.id,
            ispinned: ann.isPinned
        })
        res.status(200).json({ success: true, announcement: ann });
    } catch (error) {
        next(error);
    }
}

// post api/hackathon/:hackathonId/announcements/:annId/react
export const setreaction = async (req, res, next) => {
    try {
        const { emoji } = req.body;
        const ann = await Announcement.findById(req.params.annId);
        if (!ann) {
            return res.status(403).json({ succes: true, message: "announcement doesn't exists" });
        }
        // Toggle: if user already reacted with same emoji, remove it
        const existignIdx = ann.reactions.findIndex(
            (r) => r.user.toString() === req.user.id && r.emoji === emoji
        )
        if(existignIdx>-1){
            ann.reactions.splice()
        }
    } catch (error) {
        next(error);
    }
};


