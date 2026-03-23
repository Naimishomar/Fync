import mongoose, { Schema } from "mongoose";
import Hackathon from "./hackathons.model";
import e from "express";

const hackathonChannelSchema = new mongoose.Schema({
     Hackathon:{
        type:mongoose.Schema.Types.ObjectId;
        ref:"Hackathon",
        required:true,
        unique:true
     },
     name:{
        type:String,
        required:true,
     },
     members:[
        {
            user:{
                type:mongoose.Schema.Types.ObjectId;
                ref:"User"
            },
            role:{
                type:String,
                enum:["organiser","judge","participant"],
                default:"participant"
            },
            joinedAt:{type:Date,default:Date.now()},
            lastSeen:{type:Date,default:Date.now()}
        }
     ],
},{
    timestamps:true
})

const HackathonChannel = mongoose.model("HackathonChannel", hackathonChannelSchema );
export default HackathonChannel;