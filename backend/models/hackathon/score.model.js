import mongoose from "mongoose";
import Hackathon from "./hackathons.model";
const ScoreSchema = mongoose.Schema({
    Hackathon:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Hackathon",
        required:true
    },
    submission:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Submission",
        required:true
    },
    judde:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    criteria:{
        name:{
            type:String,
        },
        weightage:{
            type:Number,
        },
        score:{
            type:Number,
            min:0,
            max:10
        }
    },
    totalscore:{
        type:Number
    },
    feedback:{
        type:String
    }
},{
    timestamps:true
})

ScoreSchema.index({})

const Score = new mongoose.model("")