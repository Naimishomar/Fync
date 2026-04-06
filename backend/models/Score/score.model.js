import mongoose from "mongoose";
const ScoreSchema = new mongoose.Schema({
    hackathon:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Hackathon",
        required:true
    },
    Submission:{
       type:mongoose.Schema.Types.ObjectId,
       ref:"Submission",
       required:true
    },
    judge:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    criteria:[{
        name:{type:String},
        weightage:{type:Number},
        score:{type:Number , min:0 , max:10 }
    }],
    totalScore:{
        type:Number
    },
    feedback:{
        type:String
    }},
    {timestamps:true}
);
ScoreSchema.index({Submission:1,judge:1},{unique:true});

// Auto-compute weighted total before every save
scoreSchema.pre("save", function (next) {
  if (this.criteria && this.criteria.length > 0) {
    const totalWeight = this.criteria.reduce((s, c) => s + (c.weightage || 0), 0);
    const weighted    = this.criteria.reduce((s, c) => s + (c.score || 0) * (c.weightage || 0), 0);
    this.totalScore   = totalWeight > 0
      ? parseFloat((weighted / totalWeight).toFixed(2))
      : 0;
  }
  next();
});
const Score = mongoose.model("Score",ScoreSchema);
export default Score;