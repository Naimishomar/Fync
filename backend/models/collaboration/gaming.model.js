import mongoose from "mongoose";

const gamingSchema = new mongoose.Schema({
    admin:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    game_name:{
        type:String,
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
    gamingDate: { 
        type: Date, 
        required: true, 
    },
    venue:{
        type:String,
        required:true
    },
    users: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    }],
    team_size:{
        type:Number,
        required:true
    },
    college:{
        type: String,
        required:true
    },
    comments: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Comment",
        },
    ],
},{timestamps:true});

gamingSchema.index({ gamingDate: 1 }, { expireAfterSeconds: 0 });

const Gaming = mongoose.model('Gaming', gamingSchema);  
export default Gaming;