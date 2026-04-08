import SubmissionModel from "../../models/hackathon/submission.model.js";
import Hackathon from "../../models/hackathon/hackathons.model.js";
import HackathonTeam from "../../models/hackathon/team.model.js";
// import verifyTeam from "../../utils/verifyTeamMember.js";
// Get  api/submissions?hackathon=Id&status=submitted
export const getSubmissions = async (req, res, next) => {
    try {
        const { Hackathon, status, team } = req.query;
        const filter = {};
        if (Hackathon) filter.Hackathon = Hackathon;
        if (status) filter.status = status;
        if (team) filter.team = team;

        const submissions = await SubmissionModel.find(filter).populate("team", "name").populate("submittedBy", "name email avatar").populate("").populate("hackathon", "title hackathonends");

        res.status(200).json({success:true,count:submissions.length,submissions});
        
    } catch (error) {
        next(error);
    }
}

// GET /api/submissions/my/:hackathonId

export const getMySubmission = async(req,res,next)=>{
 try{
   const team = await HackathonTeam.findOne({
    hackathon:req.params.hackathonId,
    "members.user":req.user.id,
   });
   if(!team){
    return res.status(403).json({succes:true,message:"team doesn't exist"});
   }
   
   const sub = await SubmissionModel.findOne({hackathon:req.params.hackathonId,team:team._id}).populate("status").populate("team","name avatar").populate("submittedBy","name avtar");

   if(!sub){
    return res.status(403).json({succes:false,message:"submission doesn't exists"});
   }
   res.status(200).json({success:true,data:sub});
 }catch(error){
    next(error);
 }
}

// POST api/submissions - create draft
export const createSubmission = async(req,res,next)=>{
 try{
   
   const {hackathon:hackId, team:teamId, ProjectName , TagLine , description , techStack , demourl , GtihubUrl , videoUrl , presentationUrl , category }  = req.body;
  
   // verify if the hackathon exists or not 
   const hack = await Hackathon.findById(hackId);
   if(!hack){
    return res.status(403).json({succes:true,message:"hackathon doesn't exists"});
   }

   // verify the teammember
   const {team , error} = await Hackathon.findById(teamId , req.user.Id);
   if(error) return res.status(403).json({success:true,message:error});
  // check deadlines on final submit
  if(!["active","judging"].includes(hack.status)){
    return res.status(403).json({success:true,message:"Hackathon is Not accepting subsmissions"
    })
  }
  // check for the existing submission
  const submission = await SubmissionModel.find({hackathon:hackId,team:teamId}).populate("")
   const newsub = await submissions.create({
      hackathon:hackId,
      team:teamId,
      submittedBy:req.user.id,
      ProjectName,
      TagLine,
      description,
      techStack,
      category,
      demourl,
      GtihubUrl,
      videoUrl,
      presentationUrl
   })
   
   



 }catch(error){
    next(error);
 }
}


// PATCH /api/submissions/:id  — update draft (only before finalize)
export const updateSubmission = async (req, res, next) => {
  try {
    const sub = await Submission.findById(req.params.id).populate("hackathon");
    if (!sub)
      return res.status(404).json({ success: false, message: "Submission not found" });

    // Only team members can edit
    const { error } = await verifyTeamMember(sub.team, req.user._id);
    if (error) return res.status(403).json({ success: false, message: error });

    if (sub.status !== "draft")
      return res.status(400).json({ success: false, message: "Cannot edit a finalized submission" });

    if (isDeadlinePassed(sub.hackathon))
      return res.status(400).json({ success: false, message: "Submission deadline has passed" });

    const allowed = [
      "projectName", "tagline", "description", "techStack",
      "category", "githubUrl", "demoUrl", "videoUrl", "presentationUrl",
    ];
    allowed.forEach((f) => {
      if (req.body[f] !== undefined) sub[f] = req.body[f];
    });

    // Track edit history
    sub.editHistory.push({
      editedBy: req.user._id,
      note:     req.body.editNote || "Updated submission",
    });

    await sub.save();
    res.status(200).json({ success: true, submission: sub });
  } catch (err) { next(err); }
};

// POST /api/submissions/:id/finalize  — lock and submit
export const finalizeSubmission = async (req, res, next) => {
  try {
    const sub = await Submission.findById(req.params.id).populate("hackathon");
    if (!sub)
      return res.status(404).json({ success: false, message: "Submission not found" });

    // Only team members can finalize
    const { error } = await verifyTeamMember(sub.team, req.user._id);
    if (error) return res.status(403).json({ success: false, message: error });

    if (sub.status !== "draft")
      return res.status(400).json({ success: false, message: "Already finalized" });

    if (isDeadlinePassed(sub.hackathon))
      return res.status(400).json({ success: false, message: "Submission deadline has passed" });

    // Must have at least github or demo url
    if (!sub.githubUrl && !sub.demoUrl)
      return res.status(400).json({
        success: false,
        message: "Provide at least a GitHub URL or Demo URL before submitting",
      });

    sub.status      = "submitted";
    sub.submittedAt = new Date();
    await sub.save();

    // Notify hackathon channel
    const io = req.app.get("io");
    io.to(`hack:${sub.hackathon._id}`).emit("submission:new", {
      teamId:      sub.team,
      projectName: sub.projectName,
      submittedAt: sub.submittedAt,
    });

    res.status(200).json({ success: true, submission: sub });
  } catch (err) { next(err); }
};

// POST /api/submissions/:id/files  — attach file metadata (after upload to S3)
export const addFile = async (req, res, next) => {
  try {
    const sub = await Submission.findById(req.params.id).populate("hackathon");
    if (!sub)
      return res.status(404).json({ success: false, message: "Submission not found" });

    const { error } = await verifyTeamMember(sub.team, req.user._id);
    if (error) return res.status(403).json({ success: false, message: error });

    if (sub.status !== "draft")
      return res.status(400).json({ success: false, message: "Cannot add files to a finalized submission" });

    if (isDeadlinePassed(sub.hackathon))
      return res.status(400).json({ success: false, message: "Deadline passed" });

    const { name, url, size, type } = req.body;
    sub.files.push({ name, url, size, type });
    await sub.save();

    res.status(200).json({ success: true, files: sub.files });
  } catch (err) { next(err); }
};

// DELETE /api/submissions/:id/files/:fileId  — remove a file from draft
export const removeFile = async (req, res, next) => {
  try {
    const sub = await Submission.findById(req.params.id);
    if (!sub)
      return res.status(404).json({ success: false, message: "Submission not found" });

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
    const sub = await Submission.findById(req.params.id);
    if (!sub)
      return res.status(404).json({ success: false, message: "Submission not found" });

    const { error } = await verifyTeamMember(sub.team, req.user._id);
    if (error) return res.status(403).json({ success: false, message: error });

    if (sub.status !== "draft")
      return res.status(400).json({ success: false, message: "Cannot delete a finalized submission" });

    await sub.deleteOne();
    res.status(200).json({ success: true, message: "Draft deleted" });
  } catch (err) { next(err); }
};