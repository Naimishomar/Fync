import mongoose from "mongoose";
// import Hackathon from "./hackathons.model.js";
const SchemaSubmission = new mongoose.Schema({
     hackathon:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Hackathon",
        required:true,
     },
     team:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"HackathonTeam",
        required:true
     },
     submittedBy:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
     },
     ProjectName:{
        type:String,
        required:true
     },
     TagLine:{
        type:String,
        required:true
     },
     description:{
        type:String,
        required:true,
     },
     techStack:[{type:String}],
     category:{type:String},
     demourl:{
        type:String
     },
     GithubUrl:{
        type:String
     },
     videoUrl:{
        type:String
     },
     presentationUrl:{
        type:String
     },
    // `type:String` as a bare key makes Mongoose read this whole object as a
    // SchemaType definition, so `files` silently became [String] and every
    // addFile/uploadSubmissionFile push threw "Cast to string failed".
    // Nesting it as `{ type: String }` keeps it a real subdocument array.
    files:[
        {
            name:String,
            Url:String,
            type:{ type:String },
            size:String,
        }
    ],
    status:{
        type:String,
        enum:["draft","underReview","submitted","scored"],
        default:"draft"
    },
    submittedAt:  { type: Date },
    editHistory:{
        editedBy:{
            type:mongoose.Schema.Types.ObjectId,
            ref:"User",
        },
        editedAt:{
            type:Date,
            default:Date.now
        },
        note:{
            type:String,
        }}
},{
    timestamps:true
})
SchemaSubmission.index({hackathon:1,team:1},{unique:true})
// Dashboard moderation queue, judge pending lists, and "recent submissions"
SchemaSubmission.index({ hackathon: 1, status: 1 });
SchemaSubmission.index({ hackathon: 1, updatedAt: -1 });

const SubmissionModel = mongoose.model("HackathonSubmission", SchemaSubmission);
export default SubmissionModel;
