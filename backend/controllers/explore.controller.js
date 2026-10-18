import Hackathon from "../models/hackathon/hackathons.model.js";
import Opportunity from "../models/opportunity.model.js";
import Bootcamp from "../models/events/bootcamp.model.js";
import CreateSpeakerSession from "../models/events/createSpeakerSession.model.js";
import { istDayStart } from "../utils/eventTime.js";

const PER_SOURCE = 4;
const MAX_ITEMS = 10;

// "50000" -> "₹50,000"; "$5k" / "₹10k" / "Unpaid" pass through untouched.
const rupees = (v) => {
    const s = String(v ?? "").trim();
    return /^\d+$/.test(s) ? `₹${Number(s).toLocaleString("en-IN")}` : s;
};
const feeChip = (fee) => (Number(fee) > 0 ? rupees(fee) : "Free");
const modeOf = (venue) => (/online|virtual|zoom|meet/i.test(venue || "") ? "Online" : "Offline");
const collegeScope = (college) => ({
    $or: [{ isCollegeSpecific: false }, { isCollegeSpecific: true, college }],
});

const hackathon = (h) => ({
    type: "hackathon",
    id: String(h._id),
    title: h.title,
    org: h.organiser?.name,
    image: h.bannerImage || h.logo || undefined,
    chips: [h.mode, h.prizepool && `Prize ${rupees(h.prizepool)}`, "Register Now"].filter(Boolean),
    startsAt: h.hackathonstarts,
    deadline: h.registrationends || h.hackathonends,
});

const opportunity = (o) => ({
    type: o.type,
    id: String(o._id),
    title: o.title,
    org: o.company,
    // A square company logo makes a poor portrait cover, so it rides along as
    // `logo` and the client draws its own poster.
    logo: o.companyLogo || undefined,
    chips: [
        o.location,
        o.type === "internship"
            ? (o.isPaid ? `Stipend ${rupees(o.stipend)}` : "Unpaid")
            : (o.isPaid && o.stipend && o.stipend !== "Unpaid" ? rupees(o.stipend) : o.opportunityType),
        o.duration,
    ].filter(Boolean),
});

const event = (type, startKey) => (e) => ({
    type,
    id: String(e._id),
    title: e.eventName,
    org: e.college,
    image: e.banner || e.logo || undefined,
    chips: [modeOf(e.venue), feeChip(e.fee), "Register Now"],
    startsAt: e[startKey],
});

// Round-robin across sources so one busy feed can't fill the whole row.
const interleave = (lists) => {
    const out = [];
    for (let i = 0; out.length < MAX_ITEMS && lists.some((l) => i < l.length); i++)
        for (const l of lists) if (i < l.length && out.length < MAX_ITEMS) out.push(l[i]);
    return out;
};

// GET /explore/featured — same visibility rules as each feature's list endpoint,
// minus organiser-only rows, and only what can still be joined.
export const getFeatured = async (req, res, next) => {
    try {
        const now = new Date();
        const college = req.user?.college;
        const opp = (type) =>
            Opportunity.find({ isActive: true, type })
                .select("title company companyLogo location type opportunityType isPaid stipend duration")
                .sort({ createdAt: -1 }).limit(PER_SOURCE).lean();

        const [hacks, interns, jobs, camps, talks] = await Promise.all([
            Hackathon.find({
                status: { $ne: "draft" },
                hackathonends: { $gte: now },
                $or: [{ registrationends: null }, { registrationends: { $gte: now } }],
            })
                .select("title organiser bannerImage logo mode prizepool hackathonstarts hackathonends registrationends")
                .populate("organiser", "name")
                .sort({ createdAt: -1 }).limit(PER_SOURCE).lean(),
            opp("internship"),
            opp("job"),
            Bootcamp.find({ status: "open", endDate: { $gte: now }, ...collegeScope(college) })
                .select("eventName college venue fee banner logo startDate")
                .sort({ startDate: 1 }).limit(PER_SOURCE).lean(),
            CreateSpeakerSession.find({ status: "open", date: { $gte: istDayStart() }, ...collegeScope(college) })
                .select("eventName college venue fee banner logo date")
                .sort({ date: 1 }).limit(PER_SOURCE).lean(),
        ]);

        const items = interleave([
            hacks.map(hackathon),
            interns.map(opportunity),
            camps.map(event("bootcamp", "startDate")),
            jobs.map(opportunity),
            talks.map(event("speaker", "date")),
        ]);
        res.status(200).json({ success: true, items });
    } catch (error) {
        next(error);
    }
};
