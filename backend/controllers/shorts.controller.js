import express from 'express';
import Shorts from '../models/shorts.model.js';
import User from '../models/user.model.js';
import Comment from '../models/comment.model.js';

export const createShorts = async(req,res)=>{
    try {
        const { title, description} = req.body;
        if(!title || !description){
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}