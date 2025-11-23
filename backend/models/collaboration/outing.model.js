import mongoose from "mongoose";

const outingSchema = new mongoose.Schema({
    admin:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    destination:{
        type:[String],
        required:true
    },
    date:{
        type:Date,
        required:true
    },
    time:{
        type:String,
        required:true
    },
    outingDate: { 
        type: Date, 
        required: true, 
        index: true 
    },
    users: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    }],
    college:{
        type: String,
        required:true
    }
}, {timestamps: true})

const Outing = mongoose.model('Outing', outingSchema);
export default Outing;