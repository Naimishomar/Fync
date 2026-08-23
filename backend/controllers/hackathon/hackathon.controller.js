import Hackathon from "../../models/hackathon/hackathons.model.js";
import User from "../../models/user.model.js";
import Notification from "../../models/notification.model.js";
import { sendPushNotification } from "../../utils/notification.js";
import { nanoid } from "nanoid";

// Multipart form-data flattens objects/arrays into strings.
const JSON_FIELDS = ['eligibility', 'prizes', 'tags', 'rules', 'tracks', 'timeline', 'faqs', 'sponsors'];

const parseJsonFields = (body) => {
    JSON_FIELDS.forEach((field) => {
        if (typeof body[field] === 'string') {
            try {
                body[field] = JSON.parse(body[field]);
            } catch (e) {
                // not JSON — leave it as the host typed it
            }
        }
    });
    return body;
};

const attachUploads = (body, req) => {
    if (!req.files) return body;
    const files = Array.isArray(req.files) ? req.files : [];
    const findFile = (name) => files.find((f) => f.fieldname === name);

    const bannerFile = findFile('bannerImage');
    if (bannerFile) body.bannerImage = bannerFile.path;

    const logoFile = findFile('logo');
    if (logoFile) body.logo = logoFile.path;

    if (Array.isArray(body.sponsors)) {
        body.sponsors.forEach((sp, i) => {
            const spFile = findFile(`sponsorLogo_${i}`);
            if (spFile) sp.logo = spFile.path;
        });
    }
    return body;
};

/**
 * The apply link is the whole product — a listing without a working one is a
 * dead end for every student who taps it. Anything without an explicit scheme
 * gets https:// so "unstop.com/x" still opens instead of failing silently on
 * the device.
 */
const normaliseApplyLink = (raw) => {
    const link = String(raw ?? "").trim();
    if (!link) return { error: "An apply / registration link is required" };
    const withScheme = /^https?:\/\//i.test(link) ? link : `https://${link}`;
    try {
        const url = new URL(withScheme);
        if (!url.hostname.includes(".")) return { error: "That apply link doesn't look like a valid URL" };
        return { link: url.toString() };
    } catch {
        return { error: "That apply link doesn't look like a valid URL" };
    }
};


/**
 * Lifecycle is derived from the dates, never stored.
 *
 * It used to be a field the organiser flipped by hand — so a hackathon that
 * started yesterday still advertised itself as "upcoming", and the Live filter
 * matched nothing at all. The dates already know the answer; asking them costs
 * nothing and cannot drift.
 *
 * `status` on the document now means visibility only: draft or published.
 */
export const deriveStatus = (hack, now = new Date()) => {
    if (hack?.status === "draft") return "draft";
    const starts = hack?.hackathonstarts ? new Date(hack.hackathonstarts) : null;
    const ends = hack?.hackathonends ? new Date(hack.hackathonends) : null;
    if (ends && ends < now) return "completed";
    if (starts && starts > now) return "upcoming";
    if (starts && ends) return "active";
    return "upcoming";
};

/** The same rule as a Mongo query, so filtering happens in the database. */
const statusQuery = (status, now = new Date()) => {
    switch (status) {
        case "active":
            return { hackathonstarts: { $lte: now }, hackathonends: { $gte: now } };
        case "upcoming":
            return { hackathonstarts: { $gt: now } };
        case "completed":
            return { hackathonends: { $lt: now } };
        default:
            return null;
    }
};

/**
 * Recency is the wrong order for a hackathon board. A student filtering to
 * "Upcoming" wants the one closing soonest, not the one posted last.
 */
const sortFor = (status) => {
    switch (status) {
        case "active":
            return { hackathonends: 1 };      // ending soonest — apply now or miss it
        case "upcoming":
            return { hackathonstarts: 1 };    // starting soonest
        case "completed":
            return { hackathonends: -1 };     // most recently finished
        default:
            return { hackathonstarts: 1 };
    }
};

/** Responses always carry the derived lifecycle, never the stored field. */
const withStatus = (hack, now = new Date()) =>
    hack ? { ...hack, status: deriveStatus(hack, now), isDraft: hack.status === "draft" } : hack;

// POST /hackathons
export const createHackathon = async (req, res, next) => {
    try {
        const body = attachUploads(parseJsonFields({ ...req.body }), req);

        const { link, error } = normaliseApplyLink(body.applyLink);
        if (error) return res.status(400).json({ success: false, message: error });
        body.applyLink = link;

        // hackathonId (nanoid) is required+unique on the schema — generate it here
        body.hackathonId = nanoid(10);

        // Listings only: nothing about registration, teams or judging is ours
        // to accept, so it never reaches the document.
        delete body.winners;
        delete body.status;

        const hack = await Hackathon.create({ ...body, organiser: req.user.id, createdBy: req.user.id });
        res.status(201).json({ message: "hackathon created successfully", success: true, hackathon: hack });
    } catch (error) {
        next(error);
    }
}

// GET /hackathons/:hackathonId
export const gethackathon = async (req, res, next) => {
    try {
        const hack = await Hackathon.findById(req.params.hackathonId)
            .populate("organiser", "name email avatar college")
            .populate("winners.users", "name avatar college studentId")
            .lean();

        if (!hack) {
            return res.status(404).json({ success: false, message: "Hackathon not found" });
        }
        res.status(200).json({ success: true, hackathon: withStatus(hack) });
    } catch (error) {
        next(error);
    }
}

// POST /hackathons/list  (body-based filtering — GET can't have a body reliably)
export const gethackathons = async (req, res, next) => {
    const { tags, status, page = 1, limit = 10 } = req.body;
    const now = new Date();

    // Drafts are the organiser's own business and never appear in discovery.
    const filter = { status: { $ne: "draft" } };

    const window = statusQuery(status, now);
    if (window) Object.assign(filter, window);

    if (tags) filter.tags = { $in: Array.isArray(tags) ? tags : tags.split(",") };

    const skip = (Number(page) - 1) * Number(limit);
    try {
        const [hackathons, total] = await Promise.all([
            Hackathon.find(filter)
                .populate("organiser", "name avatar")
                .sort(sortFor(status))
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            Hackathon.countDocuments(filter),
        ]);
        res.status(200).json({
            success: true,
            total,
            page: Number(page),
            hackathons: hackathons.map((h) => withStatus(h, now)),
        });
    } catch (error) {
        next(error);
    }
}

// GET /hackathons/my — hackathons the user hosts, plus the ones they won
export const getMyHackathons = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const hackathons = await Hackathon.find({
            $or: [{ organiser: userId }, { "winners.users": userId }],
        })
            .populate("organiser", "name avatar")
            .select("title status hackathonstarts hackathonends registrationstart registrationends prizepool prizes tags bannerImage logo organiser applyLink applyLabel mode location winners")
            .sort({ createdAt: -1 })
            .lean();

        const now = new Date();
        const enriched = hackathons.map((h) => {
            const isOrganiser = h.organiser?._id?.toString() === userId.toString();
            const myWin = (h.winners ?? []).find((w) =>
                (w.users ?? []).some((u) => u.toString() === userId.toString())
            );
            return {
                ...withStatus(h, now),
                myRole: isOrganiser ? "organiser" : "winner",
                myWin: myWin ? { rank: myWin.rank, title: myWin.title, amount: myWin.amount } : null,
            };
        });

        res.status(200).json({ success: true, total: enriched.length, hackathons: enriched });
    } catch (error) {
        next(error);
    }
}

/**
 * PATCH /hackathons/:hackathonId/winners
 *
 * The one thing that flows back into Fync after a hackathon. Tagged students
 * get a notification, and the win lands on their profile.
 */
export const assignWinners = async (req, res, next) => {
    try {
        const hack = await Hackathon.findById(req.params.hackathonId);
        if (!hack) return res.status(404).json({ success: false, message: "Hackathon not found" });
        if (hack.organiser.toString() !== req.user.id.toString())
            return res.status(403).json({ success: false, message: "Not authorised" });

        const { winners } = req.body;
        if (!Array.isArray(winners))
            return res.status(400).json({ success: false, message: "winners must be an array" });

        // Who was already tagged — re-saving the list must not re-notify them.
        const alreadyNotified = new Set(
            hack.winners.flatMap((w) => (w.users ?? []).map((u) => u.toString()))
        );

        hack.winners = winners.map((w) => ({
            rank: Number(w.rank) || 1,
            title: w.title || "",
            amount: w.amount || "",
            teamName: w.teamName || "",
            users: Array.isArray(w.users) ? w.users.filter(Boolean) : [],
            projectLink: w.projectLink || "",
            note: w.note || "",
            wonAt: w.wonAt ? new Date(w.wonAt) : new Date(),
        }));
        await hack.save();

        const freshIds = [
            ...new Set(
                hack.winners
                    .flatMap((w) => w.users.map((u) => u.toString()))
                    .filter((id) => !alreadyNotified.has(id))
            ),
        ];

        if (freshIds.length) {
            const users = await User.find({ _id: { $in: freshIds } }).select("expoPushToken").lean();
            await Notification.insertMany(
                freshIds.map((id) => ({
                    recipient: id,
                    sender: req.user.id,
                    type: 'hackathon_announcement',
                    message: `You've been announced as a winner of ${hack.title}!`,
                    hackathon: hack._id,
                })),
                { ordered: false }
            ).catch((e) => console.error("winner notification insert failed:", e.message));

            users.forEach((u) => {
                if (u.expoPushToken) {
                    sendPushNotification(
                        u.expoPushToken,
                        `🏆 You won at ${hack.title}`,
                        "The organiser just announced the winners. Tap to see the results.",
                        { hackathonId: hack._id.toString(), type: 'hackathon_winner' }
                    );
                }
            });
        }

        const populated = await Hackathon.findById(hack._id)
            .populate("winners.users", "name avatar college studentId")
            .select("winners")
            .lean();

        const io = req.app.get("io");
        if (io) io.to(`hack:${hack._id}`).emit("hackathon:winners_announced", { winners: populated.winners });

        res.status(200).json({ success: true, winners: populated.winners });
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

        const body = attachUploads(parseJsonFields({ ...req.body }), req);

        // Winners have their own endpoint; the generic update must not be a
        // second, unvalidated way to write them.
        delete body.winners;
        delete body.organiser;
        delete body.hackathonId;

        if (body.applyLink !== undefined) {
            const { link, error } = normaliseApplyLink(body.applyLink);
            if (error) return res.status(400).json({ success: false, message: error });
            body.applyLink = link;
        }

        const updatedHack = await Hackathon.findByIdAndUpdate(req.params.hackathonId, body, {
            new: true,
            runValidators: true
        });
        res.status(200).json({ success: true, hackathon: updatedHack });
    } catch (error) {
        next(error);
    }
}

/**
 * PATCH /hackathons/:hackathonId/status
 *
 * Publish or unpublish. Live / upcoming / ended are no longer settable —
 * they come from the dates — so an organiser who wants to "end" a hackathon
 * early edits its end date, which is the thing students actually read.
 */
export const updatestatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        if (!["draft", "published"].includes(status))
            return res.status(400).json({
                success: false,
                message: 'status must be "draft" or "published" — live/upcoming/ended follow the dates',
            });

        const hack = await Hackathon.findById(req.params.hackathonId);
        if (!hack) return res.status(404).json({ success: false, message: "Hackathon not found" });
        if (hack.organiser.toString() !== req.user.id)
            return res.status(403).json({ success: false, message: "Not authorised" });

        hack.status = status;
        await hack.save();

        const derived = deriveStatus(hack);
        const io = req.app.get("io");
        if (io) io.to(`hack:${hack._id}`).emit("hackathon:status_changed", { status: derived });

        res.status(200).json({ success: true, hackathon: withStatus(hack.toObject()) });
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
        res.status(200).json({ success: true, message: "Hackathon deleted" });
    } catch (error) {
        next(error);
    }
}
