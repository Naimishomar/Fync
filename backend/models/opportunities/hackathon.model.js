import mongoose from 'mongoose';

const hackathonSchema = new mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    description:{
        type:String,
        required:true
    },
    skills:{
        type:[String],
        required:true
    },
    start_date:{
        type:Date,
        required:true
    },
    end_date:{
        type:Date,
        required:true
    },
    location:{
        type:String,
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

const Hackathon = mongoose.model('Hackathon', hackathonSchema);
export default Hackathon;