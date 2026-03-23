import { authMiddleware } from "../../middlewares/auth.middleware";
import Hackathon from "../../models/hackathon/hackathons.model";
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
        if(!hack){
            res.status(403).json({ success: false, message: "hackthon not found" });
        }
        if(hack.organiser.toString() !== req.user.id.toString()){
            res.status(403).json({ success: true, message: "Not authorised"});
        }
        const {judgeId} = req.body;
        if(hack.judges.map(String).includes(judgeId))
            return res.status(403).json({succes:false,message:"judge already Added"})
        hack.judges.push(judgeId);
        await hack.save();
        res.status(200).json({succes:true,message:"judge added successfully"});
    }
    catch (error) {
        next(error);
    }
}


// api/hackathon/:hackathonId/judges/:judgeId
export const removeJudge = async(req,res,next)=>{
    try{
     const {hackathonId} = req.params;
     const hack = await Hackathon.findById(hackathonId);
     if(!hack){
        res.status(403).json({succes:false,message:"hackathon doesnt exist"});
     }
     if(hack.organiser.toString() !== req.user.Id.toString()){
        return res.status(403).json({succes:false,message:"Not authorised"});
     }
     hack.judges = hack.judges.filter((j)=>j.toString()!==req.user.Id);
     await hack.save();
    }
    catch(error){
        next(error);
    }
}

// api/hackathon/:hackathonId
export const deletehackathon  = async(req,res,next)=>{
  try{
  const { hackathonId } = req.params;
  const hack = await Hackathon.findById(hackathonId);
  if(!hack)
    return res.status(403).json({succes:false,message:"hackathon doesnt exists"});
  if(hack.organiser.toString()!==req.user.id.toString()){
    return res.status(403).json({succes:false,message:"not authorised"});
  }
  await hack.deleteOne();
  res.status(403).json({succes:true,message:"hackathon deleted succesfully"});
  }
  catch(error){
    next(error);
  }
}


// Participants join the channel
// post /api/hackathon/:hackathonId/join - participants join the channel

export const Joinchannel = async(req,res,next)=>{ 
  try{
   const hack = await Hackathon.findById()
  }catch(error){
    next(error);
  }
}