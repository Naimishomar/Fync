import { stringify, v4 as uuidv4 } from "uuid";
import mongoose from "mongoose";
const hackathonSchema = new mongoose.Schema({
   hackathonId: {
      type: uuidv4,
      unique: true,
      required: true
   },
   title: {
      type: String,
      required: true
   },
   organiser:{
      type:uuidv4,
      require:true,
   },
   registrationstart: {
      required: true,
      types: Date
   },
   registrationends:{
      required: true,
      types: Date
   },
   hackathonstarts: {
      type: Date,
      required: true
   },
   hackathonends: {
      type: Date,
      required: true
   },
   prizepool: {
      type: String,
   },
   prizes: [{
      rank: Number,
      title: String,
      amount: String
   }],
   eligibility: {
      colleges: [String],
      Year: [String],
      branch: [String]
   },
   judgingcriteria: [
      {
         name: { type: String },
         weightage: { type: String },
         description: { type: String }
      }],
   MaxTeamSize:{
      require: true,
      type: Number,
      default: 4
   },
   createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User'
   },
   tags: {
      type: [{ type: String }]
   },
   status: {
      type: String,
      enum: ["draft", "upcoming", "judging", "completed", "active"],
      default: "Upcoming"
   },
   createdAt: {
      type: Date.now()
   },
   sponsors:[
      {name:String , logo:String}
   ],
   bannerImage:{
      type:{
         String
      }
   },
   judges: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
   participants:[{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
},
 {
   timestamps: true
})
hackathonSchema.index({status:1,tags:1});
const Hackathon = mongoose.model("Hackathon", hackathonSchema);
export default Hackathon;