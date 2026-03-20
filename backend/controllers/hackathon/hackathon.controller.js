import { authMiddleware } from "../../middlewares/auth.middleware";
import Hackathon from "../../models/hackathon/hackathons.model";
export const createHackathon = async(req,res,next)=>{
  try{
   const hack = await Hackathon.create({...req.body , organiser:req.user.id});
   res.status(200).json({message:"hackathon created sucessfully",success:true,data:hack});
  }catch(error){
      next(error);
  }
}

// get api  /api/hackathons/:id
export const gethackathon = async(req,res,next)=>{
  try{
    const res = await Hackathon.findById(req.params.id).populate("organizer","name email avatar").
    populate("jugdes","name email avatar");
    if(!hack){
        return res.status(404).json({message:"hackathon not found"});
    }
    res.status(200).json({success:true,hackathon:res})
  }catch(error){
    next(error);
  }
}

// get api /api/hackathons

export const gethackathons = async(req,res,next)=>{
    const {tags , status , mod , page=1,limit=10} = req.body;
    const filter = {};
    if(status) filter.status = status;
    if(mod) filter.mod = mod;
    if(tags) filter.tags = tags;
    const skip = (page-1)*limit;
    try
    {
      const res = await Hackathon.find()

    }
    catch(error){
     next(error);
    }
}