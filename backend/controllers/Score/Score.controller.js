import Score from "../../models/Score/score.model";
import SubmissionModel from "../../models/hackathon/submission.model";
import Hackathon from "../../models/hackathon/hackathons.model";
import client from "../../utils/redis";

const recalcAndUpdateBoard = async (hackId, subId, io) => {
  const allScores = await Score.find({ submission: subId });
  if (!allScores.length) return;

  const avg = allScores.reduce((s, sc) => s + (sc.totalScore || 0), 0) / allScores.length;
  const rounded = parseFloat(avg.toFixed(4));

  // Update Redis sorted set
  // ZADD hack:<id>:leaderboard <score> <submissionId>
  const boardKey = `hack:${hackId}:leaderboard`;
  await client.zAdd(boardKey, { score: rounded, value: subId.toString() });

  // Broadcast to all clients watching this hackathon
  io.to(`hack:${hackId}`).emit("leaderboard:updated", {
    submissionId: subId,
    newScore:     parseFloat(avg.toFixed(2)),
    judgeCount:   allScores.length,
  });

  return rounded;
};

// POST /api/scores - judges submits or update scores
export const submitforce = async(req,res,next)=>{
    const {submissionId:subId, criteria , feedback} = req.body;
    try{
     const sub = await SubmissionModel.findById(subId).populate("hackathon");
     if(!sub){
        return res.status(403).json({success:true , message:"Submission not found"});
     }
     const hack = sub.hackathon;
     // user must be the jugde of the hackathon
     const isjugdes = hack.jugdes.map(String).includes(req.user._id.toString());
     if(!isjugdes){
        return res.status(403).json({success:false , message:"you are not a judge for this hackathon"});
     }
     // check the status of the hackathon is it judging or not
     if(hack.status!=="judging"){
         return res.status(200).json({success:false , message:"Hackathon is not in the judgin phase"});
     }     
     const hackcriteria = hack.judgingcriteria.map((c)=>c.name);
     const submittedcriteria = criteria.map((c)=>c.name);
     const allvalid = submittedcriteria.every((name) => hackcriteria.includes(name));
     if(!allvalid){
        return res.status(200).json({success:false , message:"Criteria do not match"});
     }
     // upsert: One Score per judge per Submission
     const score = await Score.findOneAndUpdate(
        {submissionId:subId , jugde:req.user._id},
        { 
            hackathon:hack._id, 
            submission:subId,
            judge:req.user.id,
            criteria,
            feedback
        },
        {
          new:true , upsert:true , runValidators:true , setDefaultsOnInsert:true
        }
    )

    if(["submitted","draft"].includes(sub.status)){
        
    }

    }catch(error){

    }
}
