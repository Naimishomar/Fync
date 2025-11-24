import mongoose from 'mongoose';

const internshipSchema = new mongoose.Schema({
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
    type:{
        type:String,
        enum: ['Full Time', 'Part Time'],
        required:true
    },
    stipend:{
        type: String,
        enum: ['Paid', 'Unpaid'],
        required:true
    },
    duration:{
        type:String,
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
    }
},{timestamps:true});

const Internship = mongoose.model('Internship', internshipSchema);
export default Internship;