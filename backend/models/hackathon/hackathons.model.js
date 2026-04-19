import mongoose from "mongoose";

const hackathonSchema = new mongoose.Schema({
   hackathonId: {
      type: String,
      unique: true,
      required: true
   },
   title: {
      type: String,
      required: true
   },
   organiser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
   },
   registrationstart: {
      type: Date,
      required: true,
   },
   registrationends: {
      type: Date,
      required: true,
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
   MaxTeamSize: {
      type: Number,
      default: 4
   },
   createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
   },
   tags: {
      type: [{ type: String }]
   },
   status: {
      type: String,
      enum: ["draft", "upcoming", "judging", "completed", "active"],
      default: "upcoming"
   },
   description: {
      type: String,
      default: ""
   },
   rules: [{
      type: String
   }],
   faqs: [{
      question: String,
      answer: String
   }],
   tracks: [{
      title: String,
      description: String,
      prizes: String
   }],
   timeline: [{
      label: String,
      date: Date,
      description: String
   }],
   aboutTheOrganiser: {
      type: String,
      default: ""
   },
   contactEmail: String,
   discordLink: String,
   websiteLink: String,
   prizePoolCurrency: {
      type: String,
      default: "INR"
   },
   sponsors: [
      { 
         name: String, 
         logo: String, 
         level: { 
            type: String, 
            enum: ["Title", "Platinum", "Gold", "Silver", "Bronze", "Partner"],
            default: "Partner"
         } 
      }
   ],
   mentors: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
   judges: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
   participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
   logo: { type: String },
   bannerImage: { type: String },
},
   {
      timestamps: true
   })

hackathonSchema.index({ status: 1, tags: 1 });
const Hackathon = mongoose.model("Hackathon", hackathonSchema);
export default Hackathon;