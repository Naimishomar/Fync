import Hackathon from "../../models/hackathon/hackathons.model.js";
import HackathonChannel from "../../models/hackathon/Hackathonchannel.model.js";
import Announcement from "../../models/hackathon/announcements.model.js";

// POST /hackathons
export const createHackathon = async (req, res, next) => {
    try {
        const body = { ...req.body };
        
        // When using multipart/form-data, complex objects/arrays come as strings
        const jsonFields = [
            'eligibility', 'judgingcriteria', 'prizes', 'tags', 
            'rules', 'tracks', 'timeline', 'faqs', 'sponsors', 'mentors', 'judges'
        ];
        
        jsonFields.forEach(field => {
            if (typeof body[field] === 'string') {
                try {
                    body[field] = JSON.parse(body[field]);
                } catch (e) {
                    // fall back to original if not valid JSON
                }
            }
        });

        // Handle image uploads
        if (req.files) {
            const files = Array.isArray(req.files) ? req.files : [];
            const findFile = (name) => files.find(f => f.fieldname === name);

            const bannerFile = findFile('bannerImage');
            if (bannerFile) body.bannerImage = bannerFile.path;

            const logoFile = findFile('logo');
            if (logoFile) body.logo = logoFile.path;

            // Map sponsor logos
            if (body.sponsors && Array.isArray(body.sponsors)) {
                body.sponsors.forEach((sp, i) => {
                    const spFile = findFile(`sponsorLogo_${i}`);
                    if (spFile) sp.logo = spFile.path;
                });
            }
        }

        console.log("Saving Hackathon Body:", JSON.stringify(body, null, 2));
        const hack = await Hackathon.create({ ...body, organiser: req.user.id });
        res.status(200).json({ message: "hackathon created successfully", success: true, hackathon: hack });
    } catch (error) {
        next(error);
    }
}

// GET /hackathons/:hackathonId
export const gethackathon = async (req, res, next) => {
    try {
        // FIX: was using 'const res' which shadowed the Express res parameter
        // FIX: param is hackathonId not id, populate field is 'organiser' not 'organizer'
        const hack = await Hackathon.findById(req.params.hackathonId)
            .populate("organiser", "name email avatar")
            .populate("judges", "name email avatar")
            .populate("mentors", "name email avatar");

        if (!hack) {
            return res.status(404).json({ success: false, message: "Hackathon not found" });
        }
        res.status(200).json({ success: true, hackathon: hack });
    } catch (error) {
        next(error);
    }
}

// POST /hackathons/list  (body-based filtering — GET can't have a body reliably)
export const gethackathons = async (req, res, next) => {
    const { tags, status, mod, page = 1, limit = 10 } = req.body;
    const filter = {};
    if (status) filter.status = status;
    if (tags) filter.tags = { $in: Array.isArray(tags) ? tags : tags.split(",") };

    const skip = (Number(page) - 1) * Number(limit);
    try {
        const [hackathons, total] = await Promise.all([
            Hackathon.find(filter)
                .populate("organiser", "name avatar")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),
            Hackathon.countDocuments(filter),
        ]);
        res.status(200).json({ success: true, total, page: Number(page), hackathons });
    } catch (error) {
        next(error);
    }
}

// PATCH /hackathons/:hackathonId
export const updatehackathon = async (req, res, next) => {
    try {
        const hack = await Hackathon.findById(req.params.hackathonId);
        if (!hack) return res.status(404).json({ success: false, message: "Hackathon not found" });
        if (hack.organiser.toString() !== req.user.id)
            return res.status(403).json({ success: false, message: "Not authorised to update this hackathon" });

        const body = { ...req.body };
        const jsonFields = [
            'eligibility', 'judgingcriteria', 'prizes', 'tags', 
            'rules', 'tracks', 'timeline', 'faqs', 'sponsors', 'mentors', 'judges'
        ];
        
        jsonFields.forEach(field => {
            if (typeof body[field] === 'string') {
                try {
                    body[field] = JSON.parse(body[field]);
                } catch (e) {}
            }
        });

        if (req.files) {
            const files = Array.isArray(req.files) ? req.files : [];
            const findFile = (name) => files.find(f => f.fieldname === name);

            const bannerFile = findFile('bannerImage');
            if (bannerFile) body.bannerImage = bannerFile.path;

            const logoFile = findFile('logo');
            if (logoFile) body.logo = logoFile.path;

            if (body.sponsors && Array.isArray(body.sponsors)) {
                body.sponsors.forEach((sp, i) => {
                    const spFile = findFile(`sponsorLogo_${i}`);
                    if (spFile) sp.logo = spFile.path;
                });
            }
        }

        console.log("Updating Hackathon Body:", JSON.stringify(body, null, 2));
        const updatedHack = await Hackathon.findByIdAndUpdate(req.params.hackathonId, body, {
            new: true,
            runValidators: true
        });
        res.status(200).json({ success: true, hackathon: updatedHack });
    } catch (error) {
        next(error);
    }
}

// PATCH /hackathons/:hackathonId/status
export const updatestatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        // FIX: 'judging' was typed as 'jugding' in the allowed list
        const allowedStatus = ["active", "draft", "upcoming", "completed", "judging"];
        if (!allowedStatus.includes(status))
            return res.status(400).json({ success: false, message: "Invalid status value" });

        const hack = await Hackathon.findById(req.params.hackathonId);
        if (!hack) return res.status(404).json({ success: false, message: "Hackathon not found" });
        if (hack.organiser.toString() !== req.user.id)
            return res.status(403).json({ success: false, message: "Not authorised" });

        hack.status = status;
        await hack.save();

        const io = req.app.get("io");
        if (io) io.to(`hack:${hack._id}`).emit("hackathon:status_changed", { status });

        res.status(200).json({ success: true, hackathon: hack });
    } catch (error) {
        next(error);
    }
}

// POST /hackathons/:hackathonId/judge
export const addjudge = async (req, res, next) => {
    try {
        const hack = await Hackathon.findById(req.params.hackathonId);
        if (!hack) return res.status(404).json({ success: false, message: "Hackathon not found" });
        if (hack.organiser.toString() !== req.user.id.toString())
            return res.status(403).json({ success: false, message: "Not authorised" });

        const { judgeId } = req.body;
        if (hack.judges.map(String).includes(judgeId))
            return res.status(400).json({ success: false, message: "Judge already added" });

        hack.judges.push(judgeId);
        await hack.save();
        res.status(200).json({ success: true, message: "Judge added successfully" });
    } catch (error) {
        next(error);
    }
}

// DELETE /hackathons/:hackathonId/judges/:judgeId
export const removeJudge = async (req, res, next) => {
    try {
        const { hackathonId, judgeId } = req.params;
        const hack = await Hackathon.findById(hackathonId);
        if (!hack) return res.status(404).json({ success: false, message: "Hackathon not found" });
        // FIX: was using req.user.Id (capital I) — should be req.user.id
        if (hack.organiser.toString() !== req.user.id.toString())
            return res.status(403).json({ success: false, message: "Not authorised" });

        hack.judges = hack.judges.filter((j) => j.toString() !== judgeId);
        await hack.save();
        res.status(200).json({ success: true, message: "Judge removed" });
    } catch (error) {
        next(error);
    }
}

// DELETE /hackathons/:hackathonId
export const deletehackathon = async (req, res, next) => {
    try {
        const { hackathonId } = req.params;
        const hack = await Hackathon.findById(hackathonId);
        if (!hack) return res.status(404).json({ success: false, message: "Hackathon not found" });
        if (hack.organiser.toString() !== req.user.id.toString())
            return res.status(403).json({ success: false, message: "Not authorised" });

        await hack.deleteOne();
        // FIX: was returning 403 on success
        res.status(200).json({ success: true, message: "Hackathon deleted" });
    } catch (error) {
        next(error);
    }
}

// POST /hackathons/:hackathonId/join
export const Joinchannel = async (req, res, next) => {
    try {
        const hack = await Hackathon.findById(req.params.hackathonId);
        if (!hack) return res.status(404).json({ success: false, message: "Hackathon not found" });

        // Add user to participants list if not already there
        const alreadyParticipant = hack.participants.map(String).includes(req.user.id.toString());
        if (alreadyParticipant)
            return res.status(400).json({ success: false, message: "Already joined this hackathon" });

        hack.participants.push(req.user.id);
        await hack.save();

        // Find or create the channel
        let channel = await HackathonChannel.findOne({ Hackathon: hack._id });
        if (channel && !channel.members.some(m => m.user.toString() === req.user.id.toString())) {
            channel.members.push({ user: req.user.id, role: "participant" });
            await channel.save();
        }

        const io = req.app.get("io");
        if (io) {
            io.to(`hack:${hack._id}`).emit("channel:member_joined", {
                userId: req.user.id,
                name: req.user.name,
                avatar: req.user.avatar,
            });
        }

        res.status(200).json({ success: true, message: "Joined the hackathon channel!" });
    } catch (error) {
        next(error);
    }
}

// GET /hackathons/:hackathonId/channel
export const gethackchannels = async (req, res, next) => {
    try {
        const { hackathonId } = req.params;
        // FIX: was calling `hackathonchannel` (lowercase, undefined) instead of HackathonChannel
        const channel = await HackathonChannel.findOne({ Hackathon: hackathonId })
            .populate("members.user", "avatar name college skills");
        if (!channel)
            return res.status(404).json({ success: false, message: "Channel not found" });

        return res.status(200).json({ success: true, channel });
    } catch (error) {
        next(error);
    }
}
