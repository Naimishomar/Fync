import express from 'express';
import User from '../../models/user.model.js';

export const findTeamMembers = async(req,res)=>{
    try {
        const members = await User.find();
        if(!members){
            return res.status(404).json({ success: false, message: 'Members not found' });
        }
        return res.status(200).json({ success: true, message: 'Members fetched successfully', members });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}