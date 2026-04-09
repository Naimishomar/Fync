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
    files:[
        {
            name:String,
            Url:String,
            type:String,
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

const SubmissionModel = mongoose.model("HackathonSubmission", SchemaSubmission);
export default SubmissionModel;
