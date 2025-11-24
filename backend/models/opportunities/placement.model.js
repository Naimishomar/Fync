import mongoose from 'mongoose';

const placementSchema = new mongoose.Schema({
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
    job_type:{
        type: String,
        enum: ['Remote', 'Onsite'],
        required:true
    },
    package:{
        type: Number,
        required:true
    },
    type:{
        type:String,
        enum: ['Intern','Full Time', 'Part Time'],
        required:true
    },
    posted_by:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    apply_link:{
        type:String,
        required:true
    },
    location:{
        type:String,
        required:true
    }
},{timestamps:true});

const Placement = mongoose.model('Internship', placementSchema);
export default Placement;