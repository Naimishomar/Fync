import mongoose from "mongoose";
const announcementSchema = mongoose.Schema({
    hackathon:{
       type:mongoose.Schema.Types.ObjectId,
       ref:"Hackathon",
       required:true,
    },
    author:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    Title:{
        type:String,
        required:true,
        trim:true
    },
    body:{
        type:String,
        required:true,
    },
    type:{
        type:String,
        enum:["general","important","schedule_change","result"],
        default:"general"
    },
    isPinned:{
        type:Boolean,
        default:false
    },
    reactions:[
        {
            user:{type:mongoose.Schema.Types.ObjectId,ref:"User"},
            emoji:{type:String}
        }
    ],
    readby:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User"
    }
},{ timestamps: true });

const Announcement = mongoose.model("Announcement",announcementSchema);
export default Announcement;