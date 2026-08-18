import SubmissionModel from "../../models/hackathon/submission.model.js";
import Hackathon from "../../models/hackathon/hackathons.model.js";
import HackathonTeam from "../../models/hackathon/team.model.js";

// Helper: check if hackathon submission deadline has passed
const isDeadlinePassed = (hack) => {
    return hack.hackathonends && new Date() > new Date(hack.hackathonends);
};

// Helper: verify that a user is a member of a given team
const verifyTeamMember = async (teamId, userId) => {
    const team = await HackathonTeam.findById(teamId);
    if (!team) return { error: "Team not found" };
    const isMember = team.members.some((m) => m.user.toString() === userId.toString());
    if (!isMember) return { error: "You are not a member of this team" };
    return { team };
};

// GET api/submissions?hackathon=Id&status=submitted
export const getSubmissions = async (req, res, next) => {
    try {
        // FIX: was using 'Hackathon' (capital H) but schema field is 'hackathon' (lowercase)
        const { hackathon, status, team } = req.query;
        const filter = {};
        if (hackathon) filter.hackathon = hackathon;
        if (status) filter.status = status;
        if (team) filter.team = team;

        // Authorization gate: only organiser, judges, or team members may list.
        // The hackathon lookup and the team lookup do not depend on each other,
        // so they cost one wait instead of two.
        if (hackathon) {
            const [hack, myTeam] = await Promise.all([
                Hackathon.findById(hackathon).select("organiser judges status").lean(),
                HackathonTeam.findOne({ hackathon, "members.user": req.user.id }).select("_id").lean(),
            ]);
            if (!hack) return res.status(404).json({ success: false, message: "Hackathon not found" });

            const isOrganiser = hack.organiser.toString() === req.user.id.toString();
            const isJudge = hack.judges.map(String).includes(req.user.id.toString());

            if (!isOrganiser && !isJudge && !myTeam) {
                return res.status(403).json({ success: false, message: "You are not authorised to view submissions" });
            }
            // Non-organisers/judges only see their own team's submission
            if (!isOrganiser && !isJudge) filter.team = myTeam._id;
        }

        // No `.populate("hackathon")`: the caller filtered by hackathon, so it
        // already has that document — it was a round trip to re-send known data.
        const submissions = await SubmissionModel.find(filter)
            .populate("team", "name")
            .populate("submittedBy", "name email avatar")
            .lean();

        res.status(200).json({ success: true, count: submissions.length, submissions });

    } catch (error) {
        next(error);
    }
}

// GET /api/submissions/my/:hackathonId
export const getMySubmission = async (req, res, next) => {
    try {
        const team = await HackathonTeam.findOne({
            hackathon: req.params.hackathonId,
            "members.user": req.user.id,
        }).select("_id name members").lean();
        if (!team) {
            return res.status(404).json({ success: false, message: "You are not in a team for this hackathon" });
        }

        // FIX: was .populate("status") — status is not a ref and cannot be populated
        // No `.populate("team")` either: the team document was just fetched above,
        // so populating it was a second round trip for data already in hand.
        const sub = await SubmissionModel.findOne({ hackathon: req.params.hackathonId, team: team._id })
            .populate("submittedBy", "name avatar")
            .lean();

        if (!sub) {
            return res.status(404).json({ success: false, message: "submission doesn't exist" });
        }
        sub.team = team;
        res.status(200).json({ success: true, data: sub });
    } catch (error) {
        next(error);
    }
}

// POST api/submissions - create draft
export const createSubmission = async (req, res, next) => {
    try {
        // FIX: typo GtihubUrl -> GithubUrl (matches schema field)
        const { hackathon: hackId, team: teamId, ProjectName, TagLine, description, techStack, demourl, GithubUrl, videoUrl, presentationUrl, category } = req.body;

        // verify hackathon exists
        const hack = await Hackathon.findById(hackId);
        if (!hack) {
            return res.status(404).json({ success: false, message: "hackathon doesn't exist" });
        }

        // FIX: was calling Hackathon.findById(teamId, req.user.Id) — wrong model, wrong API
        // Verify the user is a member of the specified team
        const { team, error } = await verifyTeamMember(teamId, req.user.id);
        if (error) return res.status(403).json({ success: false, message: error });

        // check hackathon status
        if (!["active", "judging"].includes(hack.status)) {
            return res.status(400).json({ success: false, message: "Hackathon is not accepting submissions" });
        }

        // check for existing submission (one per team per hackathon)
        const existing = await SubmissionModel.findOne({ hackathon: hackId, team: teamId });
        if (existing) {
            return res.status(400).json({ success: false, message: "Your team already has a submission for this hackathon" });
        }

        // FIX: was calling `submissions.create(...)` (undefined) — should be SubmissionModel.create()
        const newsub = await SubmissionModel.create({
            hackathon: hackId,
            team: teamId,
            submittedBy: req.user.id,
            ProjectName,
            TagLine,
            description,
            techStack,
            category,
            demourl,
            GithubUrl,
            videoUrl,
            presentationUrl,
            status: "draft",
        });

        return res.status(201).json({ success: true, submission: newsub });

    } catch (error) {
        next(error);
    }
}


// PATCH /api/submissions/:id  — update draft (only before finalize)
export const updateSubmission = async (req, res, next) => {
    try {
        // FIX: was using undefined `Submission` — should be SubmissionModel
        const sub = await SubmissionModel.findById(req.params.id).populate("hackathon", "hackathonends status");
        if (!sub)
            return res.status(404).json({ success: false, message: "Submission not found" });

        // Only team members can edit
        const { error } = await verifyTeamMember(sub.team, req.user.id);
        if (error) return res.status(403).json({ success: false, message: error });

        if (sub.status !== "draft")
            return res.status(400).json({ success: false, message: "Cannot edit a finalized submission" });

        if (isDeadlinePassed(sub.hackathon))
            return res.status(400).json({ success: false, message: "Submission deadline has passed" });

        const allowed = [
            "ProjectName", "TagLine", "description", "techStack",
            "category", "GithubUrl", "demourl", "videoUrl", "presentationUrl",
        ];
        allowed.forEach((f) => {
            if (req.body[f] !== undefined) sub[f] = req.body[f];
        });

        // FIX: schema has editHistory as a single object, not an array — update it directly
        sub.editHistory = {
            editedBy: req.user.id,
            editedAt: new Date(),
            note: req.body.editNote || "Updated submission",
        };

        await sub.save();
        res.status(200).json({ success: true, submission: sub });
    } catch (err) { next(err); }
};

// POST /api/submissions/:id/finalize  — lock and submit
export const finalizeSubmission = async (req, res, next) => {
    try {
        // FIX: was using undefined `Submission` — should be SubmissionModel
        const sub = await SubmissionModel.findById(req.params.id).populate("hackathon", "hackathonends status");
        if (!sub)
            return res.status(404).json({ success: false, message: "Submission not found" });

        // Only team members can finalize
        const { error } = await verifyTeamMember(sub.team, req.user.id);
        if (error) return res.status(403).json({ success: false, message: error });

        if (sub.status !== "draft")
            return res.status(400).json({ success: false, message: "Already finalized" });

        if (isDeadlinePassed(sub.hackathon))
            return res.status(400).json({ success: false, message: "Submission deadline has passed" });

        // Must have at least github or demo url
        if (!sub.GithubUrl && !sub.demourl)
            return res.status(400).json({
                success: false,
                message: "Provide at least a GitHub URL or Demo URL before submitting",
            });

        sub.status = "submitted";
        sub.submittedAt = new Date();
        await sub.save();

        // Notify hackathon channel
        const io = req.app.get("io");
        if (io) {
            io.to(`hack:${sub.hackathon._id}`).emit("submission:new", {
                teamId: sub.team,
                projectName: sub.ProjectName,
                submittedAt: sub.submittedAt,
            });
        }

        res.status(200).json({ success: true, submission: sub });
    } catch (err) { next(err); }
};

// POST /api/submissions/:id/files  — attach file metadata (after upload to R2/S3)
export const addFile = async (req, res, next) => {
    try {
        // FIX: was using undefined `Submission` — should be SubmissionModel
        const sub = await SubmissionModel.findById(req.params.id).populate("hackathon", "hackathonends status");
        if (!sub)
            return res.status(404).json({ success: false, message: "Submission not found" });

        const { error } = await verifyTeamMember(sub.team, req.user.id);
        if (error) return res.status(403).json({ success: false, message: error });

        if (sub.status !== "draft")
            return res.status(400).json({ success: false, message: "Cannot add files to a finalized submission" });

        if (isDeadlinePassed(sub.hackathon))
            return res.status(400).json({ success: false, message: "Deadline passed" });

        const { name, Url, size, type } = req.body;
        sub.files.push({ name, Url, size, type });
        await sub.save();

        res.status(200).json({ success: true, files: sub.files });
    } catch (err) { next(err); }
};

// POST /api/submissions/:id/upload  — multipart file upload straight to R2
export const uploadSubmissionFile = async (req, res, next) => {
    try {
        const sub = await SubmissionModel.findById(req.params.id).populate("hackathon", "hackathonends status");
        if (!sub)
            return res.status(404).json({ success: false, message: "Submission not found" });

        const { error } = await verifyTeamMember(sub.team, req.user.id);
        if (error) return res.status(403).json({ success: false, message: error });

        if (sub.status !== "draft")
            return res.status(400).json({ success: false, message: "Cannot add files to a finalized submission" });

        if (isDeadlinePassed(sub.hackathon))
            return res.status(400).json({ success: false, message: "Deadline passed" });

        if (!req.file || !req.file.path)
            return res.status(400).json({ success: false, message: "No file uploaded" });

        sub.files.push({
            name: req.file.originalname,
            Url: req.file.path,
            size: String(req.file.size || 0),
            type: req.file.mimetype,
        });
        await sub.save();

        res.status(200).json({ success: true, files: sub.files });
    } catch (err) { next(err); }
};

// DELETE /api/submissions/:id/files/:fileId  — remove a file from draft
export const removeFile = async (req, res, next) => {
    try {
        // FIX: was using undefined `Submission` — should be SubmissionModel
        const sub = await SubmissionModel.findById(req.params.id);
        if (!sub)
            return res.status(404).json({ success: false, message: "Submission not found" });

        // FIX: was missing team-member verification — any auth user could delete files
        const { error } = await verifyTeamMember(sub.team, req.user.id);
        if (error) return res.status(403).json({ success: false, message: error });

        if (sub.status !== "draft")
            return res.status(400).json({ success: false, message: "Cannot modify a finalized submission" });

        sub.files = sub.files.filter((f) => f._id.toString() !== req.params.fileId);
        await sub.save();

        res.status(200).json({ success: true, files: sub.files });
    } catch (err) { next(err); }
};

// DELETE /api/submissions/:id  — only drafts can be deleted
export const deleteSubmission = async (req, res, next) => {
    try {
        // FIX: was using undefined `Submission` — should be SubmissionModel
        const sub = await SubmissionModel.findById(req.params.id);
        if (!sub)
            return res.status(404).json({ success: false, message: "Submission not found" });

        const { error } = await verifyTeamMember(sub.team, req.user.id);
        if (error) return res.status(403).json({ success: false, message: error });

        if (sub.status !== "draft")
            return res.status(400).json({ success: false, message: "Cannot delete a finalized submission" });

        await sub.deleteOne();
        res.status(200).json({ success: true, message: "Draft deleted" });
    } catch (err) { next(err); }
};