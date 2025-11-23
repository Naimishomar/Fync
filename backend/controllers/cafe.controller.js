import express from 'express';
import Cafe from '../models/cafe.model.js';

export const addCafe = async(req,res)=>{
    try {
        const { cafe_name, cafe_description, cafe_owner, cafe_account_number, ifsc_code } = req.body;
        if(!cafe_name || !cafe_description || !cafe_owner || !cafe_account_number || !ifsc_code){
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        else{
            let cafe_image_url = "";
            if(req.files){
                cafe_image_url = req.files.path;
            }
            const cafe = await Cafe.create({
                cafe_name,
                cafe_description,
                cafe_image: cafe_image_url,
                cafe_owner: req.user.id,
                college: req.user.college
            })
            return res.status(200).json({ success: true, message: 'Cafe created successfully', cafe });
        }
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const getAllCafes = async(req,res)=>{
    try {
        const cafes = await Cafe.find({ college: req.user.college });
        if(!cafes){
            return res.status(404).json({ success: false, message: 'Cafes not found' });
        }
        return res.status(200).json({ success: true, message: 'Cafes fetched successfully', cafes });
    } catch (error) {
       console.log("Intenal server error", error);
       return res.status(500).json({ success: false, message: "Internal server error" });
    }
}