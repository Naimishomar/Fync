import Hackathon from "../../models/hackathon/hackathons.model.js";
import HackathonChannel from "../../models/hackathon/Hackathonchannel.model.js";
import Announcement from "../../models/hackathon/announcements.model.js";
import HackathonTeam from "../../models/hackathon/team.model.js";
import Submission from "../../models/hackathon/submission.model.js";
import Score from "../../models/hackathon/score.model.js";
import { nanoid } from "nanoid";

// Normalize stringified judging criteria weightage → Number
const normalizeCriteria = (criteria) => {
  if (!Array.isArray(criteria)) return criteria;
  return criteria.map((c) => ({
    ...c,
    weightage: c.weightage !== undefined && c.weightage !== "" ? Number(c.weightage) : 1,
  }));
};

// For each judge: how many submissions they still have to score
// Uses an aggregation so we never materialize the full Score collection for a hackathon.
const getJudgeProgress = async (hackId) => {
  const [activeSubs, judgedRows] = await Promise.all([
    Submission.countDocuments({ hackathon: hackId, status: { $in: ["submitted", "underReview"] } }),
    Score.aggregate([
      { $match: { hackathon: hackId } },
      { $group: { _id: "$judge", count: { $sum: 1 } } },
    ]),
  ]);

  const perJudge = {};
  judgedRows.forEach((row) => {
    perJudge[row._id.toString()] = row.count;
  });
  return {
    totalSubmissions: activeSubs,
    judged: perJudge,
  };
};

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

        if (body.judgingcriteria) body.judgingcriteria = normalizeCriteria(body.judgingcriteria);

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

        // hackathonId (nanoid) is required+unique on the schema — generate it here
        body.hackathonId = nanoid(10);

        console.log("Saving Hackathon Body:", JSON.stringify(body, null, 2));
        const hack = await Hackathon.create({ ...body, organiser: req.user.id });
        res.status(201).json({ message: "hackathon created successfully", success: true, hackathon: hack });
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
            .populate("mentors", "name email avatar")
            .populate({
                path: "winners.submission",
                select: "ProjectName TagLine status",
            })
            .populate({
                path: "winners.team",
                select: "name",
            })
            .lean();

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
    const { tags, status, page = 1, limit = 10 } = req.body;
    const filter = {};
    if (status) filter.status = status;
    else filter.status = { $ne: "draft" };
    if (tags) filter.tags = { $in: Array.isArray(tags) ? tags : tags.split(",") };

    const skip = (Number(page) - 1) * Number(limit);
    try {
        const [hackathons, total] = await Promise.all([
            Hackathon.find(filter)
                .populate("organiser", "name avatar")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            Hackathon.countDocuments(filter),
        ]);
        res.status(200).json({ success: true, total, page: Number(page), hackathons });
    } catch (error) {
        next(error);
    }
}

// GET /hackathons/my — hackathons the current user organised, participates in, or has a team in
// Batch strategy: 3 queries total (teams + submissions are grouped per hackathon in memory)
// instead of 2 extra queries PER hackathon.
export const getMyHackathons = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // The team documents are fetched up front rather than after the id set is
        // known: "teams this user is in" needs no hackathon filter, and it yields
        // the same hackathon ids the old `distinct` call went and asked for. That
        // removes a whole dependent wait from the chain.
        const [teams, organised, participated] = await Promise.all([
            HackathonTeam.find({ "members.user": userId }).select("hackathon name _id").lean(),
            Hackathon.find({ organiser: userId }).distinct("_id"),
            Hackathon.find({ participants: userId }).distinct("_id"),
        ]);

        const idSet = new Set([
            ...teams.map((t) => t.hackathon.toString()),
            ...organised.map(String),
            ...participated.map(String),
        ]);
        const ids = [...idSet];
        if (!ids.length) return res.status(200).json({ success: true, hackathons: [], total: 0 });

        const teamIds = teams.map((t) => t._id);

        const [hackathons, submissions] = await Promise.all([
            Hackathon.find({ _id: { $in: ids } })
                .populate("organiser", "name avatar")
                .select("title status hackathonstarts hackathonends registrationstart registrationends prizepool prizes tags MaxTeamSize participants bannerImage logo organiser")
                .sort({ createdAt: -1 })
                .lean(),
            teamIds.length
                ? Submission.find({ team: { $in: teamIds } }).select("hackathon team status ProjectName").lean()
                : [],
        ]);

        const teamByHack = new Map();
        teams.forEach((t) => teamByHack.set(t.hackathon.toString(), t));

        const subByTeam = new Map();
        submissions.forEach((s) => subByTeam.set(s.team.toString(), s));

        const enriched = hackathons.map((h) => {
            const isOrganiser = h.organiser?._id?.toString() === userId.toString();
            const team = teamByHack.get(h._id.toString());
            const submission = team ? subByTeam.get(team._id.toString()) : null;
            return {
                ...h,
                myRole: isOrganiser ? "organiser" : team ? "team-member" : "participant",
                myTeam: team ? { _id: team._id, name: team.name } : null,
                mySubmission: submission ? { _id: submission._id, status: submission.status, ProjectName: submission.ProjectName } : null,
            };
        });

        res.status(200).json({ success: true, total: enriched.length, hackathons: enriched });
    } catch (error) {
        next(error);
    }
}

// GET /hackathons/:hackathonId/dashboard — organiser analytics + moderation queue
export const getDashboard = async (req, res, next) => {
    try {
        const hack = await Hackathon.findById(req.params.hackathonId).lean();
        if (!hack) return res.status(404).json({ success: false, message: "Hackathon not found" });
        if (hack.organiser.toString() !== req.user.id.toString())
            return res.status(403).json({ success: false, message: "Not authorised" });

        // One $facet instead of four counts plus a find: same answers, one query.
        // More importantly the moderation queue no longer populates `team`,
        // which was a second dependent wait. The hackathon's teams are a small,
        // bounded set, so they are fetched alongside everything else and the
        // names are stitched in memory — parallel work instead of serial.
        const [teams, subStats, judgeProgress] = await Promise.all([
            HackathonTeam.find({ hackathon: hack._id }).select("_id name").lean(),
            Submission.aggregate([
                { $match: { hackathon: hack._id } },
                {
                    $facet: {
                        total:   [{ $count: "n" }],
                        scored:  [{ $match: { status: "scored" } }, { $count: "n" }],
                        pending: [{ $match: { status: { $in: ["submitted", "underReview"] } } }, { $count: "n" }],
                        recent: [
                            { $sort: { updatedAt: -1 } },
                            { $limit: 10 },
                            { $project: { ProjectName: 1, TagLine: 1, status: 1, team: 1, submittedAt: 1, updatedAt: 1 } },
                        ],
                    },
                },
            ]),
            getJudgeProgress(hack._id),
        ]);

        const facet = subStats[0] ?? {};
        const count = (bucket) => facet[bucket]?.[0]?.n ?? 0;
        const teamById = new Map(teams.map((t) => [t._id.toString(), { _id: t._id, name: t.name }]));

        const participantCount = hack.participants?.length || 0;
        const teamCount        = teams.length;
        const submissionCount  = count("total");
        const scoredCount      = count("scored");
        const pendingCount     = count("pending");
        const recentSubmissions = (facet.recent ?? []).map((sub) => ({
            ...sub,
            team: sub.team ? teamById.get(sub.team.toString()) ?? null : null,
        }));

        const judgeProgressCount = Object.keys(judgeProgress.judged || {}).length;

        res.status(200).json({
            success: true,
            stats: {
                participants: participantCount,
                teams: teamCount,
                submissions: submissionCount,
                scored: scoredCount,
                pendingReview: pendingCount,
                judgeProgress: judgeProgressCount,
                judges: hack.judges?.length || 0,
            },
            recentSubmissions,
            judgeProgress,
            winners: hack.winners || [],
            hackathon: hack,
        });
    } catch (error) {
        next(error);
    }
}

// PATCH /hackathons/:hackathonId/winners — persist winners + credit fync score
export const assignWinners = async (req, res, next) => {
    try {
        const hack = await Hackathon.findById(req.params.hackathonId);
        if (!hack) return res.status(404).json({ success: false, message: "Hackathon not found" });
        if (hack.organiser.toString() !== req.user.id.toString())
            return res.status(403).json({ success: false, message: "Not authorised" });

        const { winners } = req.body;
        if (!Array.isArray(winners))
            return res.status(400).json({ success: false, message: "winners must be an array" });

        hack.winners = winners.map((w) => ({
            rank: w.rank,
            title: w.title || "",
            amount: w.amount || "",
            submission: w.submissionId || w.submission,
            team: w.teamId || w.team,
            wonAt: new Date(),
        }));
        await hack.save();

        // Credit fync score "won" for winning team members
        const winningTeamIds = hack.winners.map((w) => w.team?.toString()).filter(Boolean);
        if (winningTeamIds.length) {
            const teams = await HackathonTeam.find({ _id: { $in: winningTeamIds } });
            const winnerIds = new Set();
            teams.forEach((t) => {
                t.members.forEach((m) => winnerIds.add(m.user.toString()));
            });
            for (const uid of winnerIds) {
                try {
                    const { calculateFyncScore } = await import("../../services/fyncScore.service.js");
                    await calculateFyncScore(uid).catch(() => {});
                } catch (e) { console.error("fync score update failed for", uid, e.message); }
            }
        }

        const io = req.app.get("io");
        if (io) {
            io.to(`hack:${hack._id}`).emit("hackathon:winners_announced", { winners: hack.winners });
        }

        res.status(200).json({ success: true, winners: hack.winners });
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

        if (body.judgingcriteria) body.judgingcriteria = normalizeCriteria(body.judgingcriteria);

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
        // Only the fields the guardrails need — avoid pulling the whole doc incl. participants array
        const hack = await Hackathon.findById(req.params.hackathonId)
            .select("status registrationstart registrationends participants title");
        if (!hack) return res.status(404).json({ success: false, message: "Hackathon not found" });

        // Registration-window + status validation (production-grade guardrails)
        const now = new Date();
        if (["draft", "completed"].includes(hack.status))
            return res.status(400).json({ success: false, message: "Registrations are closed for this hackathon" });

        if (hack.registrationstart && now < new Date(hack.registrationstart))
            return res.status(400).json({ success: false, message: "Registration hasn't opened yet" });

        if (hack.registrationends && now > new Date(hack.registrationends))
            return res.status(400).json({ success: false, message: "Registration window has closed" });

        // Atomic add — $addToSet avoids reading/writing the whole participants array
        const alreadyParticipant = hack.participants.map(String).includes(req.user.id.toString());
        if (!alreadyParticipant) {
            await Hackathon.updateOne(
                { _id: hack._id },
                { $addToSet: { participants: req.user.id } }
            );
        }

        // Find or create the channel (previous code only ever found — never created)
        let channel = await HackathonChannel.findOne({ Hackathon: hack._id });
        if (!channel) {
            channel = await HackathonChannel.create({
                Hackathon: hack._id,
                name: hack.title,
                members: [],
            });
        }
        if (!channel.members.some(m => m.user.toString() === req.user.id.toString())) {
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
            .populate("members.user", "avatar name college skills")
            .lean();
        if (!channel)
            return res.status(404).json({ success: false, message: "Channel not found" });

        return res.status(200).json({ success: true, channel });
    } catch (error) {
        next(error);
    }
}
