import mongoose from "mongoose";

const workshopSchema = new mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    description:{
        type:String,
        required:true
    },
    guest:{
        type: [String],
        required:true
    },
    start_date:{
        type:Date,
        required:true
    },
    posted_by:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    status:{
        type:String,
        enum: ['Ongoing', 'Completed', 'Cancelled'],
        default: 'Ongoing',
    }
},{timestamps:true});

const Workshop = mongoose.model('Workshop', workshopSchema);
export default Workshop;