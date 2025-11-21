import express from 'express';
import OLX from '../models/olx.model.js';
import User from '../models/user.model.js';

export const sellProduct = async(req,res)=>{
    try {
        
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}