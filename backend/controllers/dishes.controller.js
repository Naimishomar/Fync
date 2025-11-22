import express from 'express';
import Dishes from '../models/dishes.model.js';

export const addDishes = async(req,res)=>{
    try {
        const { dish_name, dish_price, dish_type, dish_category, ingredients } = req.body;
        const {disk_cafe} = req.params;
        if(!dish_name || !dish_price || !dish_type || !dish_category || !ingredients || !disk_cafe){
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        else{
            const dishes = await Dishes.create({
                dish_name,
                dish_price,
                dish_type,
                dish_category,
                ingredients,
                dish_cafe: disk_cafe
            })
            return res.status(200).json({ success: true, message: 'Dishes created successfully', dishes });
        }
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const getDishesOfParticularCafe = async(req,res)=>{
    try {
        const {disk_cafe} = req.params;
        if(!disk_cafe){
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        const dishes = await Dishes.find({ disk_cafe: disk_cafe })
        if(!dishes){
            return res.status(404).json({ success: false, message: 'Dishes not found' });
        }
        return res.status(200).json({ success: true, message: 'Dishes fetched successfully', dishes });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const getDetailsOfParticularDish = async(req,res)=>{
    try {
        const {dish_id} = req.params;
        if(!dish_id){
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        const dishes = await Dishes.findById(dish_id);
        if(!dishes){
            return res.status(404).json({ success: false, message: 'Dishes not found' });
        }
        return res.status(200).json({ success: true, message: 'Dishes fetched successfully', dishes });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}