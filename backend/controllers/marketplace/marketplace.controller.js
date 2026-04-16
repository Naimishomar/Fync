import express from "express";
import MarketPlace from "../../models/marketplace/marketplace.model.js";
import User from "../../models/user.model.js";
import { uploadToR2 } from "../../utils/r2.js";

export const createProduct = async(req,res)=>{
    try {
        const {product_name, product_description, coins_required, is_available} = req.body;
        if(!product_name || !product_description || !coins_required){
            return res.status(400).json({message: "All fields are required", success: false});
        }
        if(req.user.user_access !== 'admin'){
            return res.status(403).json({message: "Unauthorized", success: false});
        }
        
        let product_image = "";
        if (req.file) {
            product_image = await uploadToR2(
                req.file.buffer,
                "marketplace",
                req.file.originalname,
                req.file.mimetype
            );
        } else {
            return res.status(400).json({message: "Product image is required", success: false});
        }
        const product = await MarketPlace.create({
            product_name,
            product_description,
            coins_required,
            product_image,
            is_available: is_available === 'false' ? false : true
        });
        return res.status(201).json({message: "Product created successfully", success: true, product});
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({message: "Internal server error", success: false});
    }
}

export const getProduct = async(req,res)=>{
    try {
        const products = await MarketPlace.find();
        if(!products){
            return res.status(404).json({message: "No products found", success: false});
        }
        // Compute admin status server-side — never trust the client for this
        const isAdmin = req.user.user_access === 'admin';
        return res.status(200).json({message: "Products fetched successfully", success: true, products, isAdmin});
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({message: "Internal server error", success: false});
    }
}

export const updateProduct = async(req,res)=>{
    try {
        const {product_id} = req.params;
        const {product_name, product_description, coins_required, is_available} = req.body;
        if(!product_id){
            return res.status(400).json({message: "Product ID is required", success: false});
        }
        if(req.user.user_access !== 'admin'){
            return res.status(403).json({message: "Unauthorized", success: false});
        }
        const product = await MarketPlace.findById(product_id);
        if(!product){
            return res.status(404).json({message: "Product not found", success: false});
        }
        if(product_name){
            product.product_name = product_name;
        }
        if(product_description){
            product.product_description = product_description;
        }
        if(coins_required){
            product.coins_required = coins_required;
        }
        if(is_available !== undefined){
            product.is_available = is_available;
        }
        await product.save();
        return res.status(200).json({message: "Product updated successfully", success: true, product});
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({message: "Internal server error", success: false});
    }
}

export const deleteProduct = async(req,res)=>{
    try {
        const {product_id} = req.params;
        if(!product_id){
            return res.status(400).json({message: "Product ID is required", success: false});
        }
        if(req.user.user_access !== 'admin'){
            return res.status(403).json({message: "Unauthorized", success: false});
        }
        const product = await MarketPlace.findById(product_id);
        if(!product){
            return res.status(404).json({message: "Product not found", success: false});
        }
        await product.deleteOne();
        return res.status(200).json({message: "Product deleted successfully", success: true});
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({message: "Internal server error", success: false});
    }
}

export const buyProduct = async(req,res)=>{
    try {
        const {product_id} = req.params;
        if(!product_id){
            return res.status(400).json({message: "Product ID is required", success: false});
        }
        const product = await MarketPlace.findById(product_id);
        if(!product){
            return res.status(404).json({message: "Product not found", success: false});
        }
        const user = await User.findById(req.user.id);
        if(!user){
            return res.status(404).json({message: "User not found", success: false});
        }

        const { address, mobileNumber, pincode } = req.body;
        if (!address || !mobileNumber || !pincode) {
            return res.status(400).json({ message: "Address, mobile number, and pincode are required", success: false });
        }

        if(user.coins < product.coins_required){
            return res.status(400).json({message: "Insufficient coins", success: false});
        }
        
        user.coins -= product.coins_required;
        user.redeemedItems.push({
            item: product._id,
            product_name: product.product_name,
            coins_required: product.coins_required,
            address: address,
            pincode: pincode,
            mobileNumber: mobileNumber,
            redeemDate: new Date()
        });

        await user.save();
        return res.status(200).json({message: "Product bought successfully", success: true, remaining_coins: user.coins});
    } catch (error) {
        console.log("Internal server error in buyProduct:", error);
        return res.status(500).json({message: "Internal server error", success: false});  
    }
}

export const getRedemptions = async(req,res)=>{
    try {
        if(req.user.user_access !== 'admin'){
            return res.status(403).json({message: "Unauthorized", success: false});
        }
        
        const redemptions = await User.find({ "redeemedItems.0": { $exists: true } })
            .select("name username redeemedItems college avatar mobileNumber")
            .sort({ "redeemedItems.redeemDate": -1 });
            
        return res.status(200).json({message: "Redemptions fetched successfully", success: true, redemptions});
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({message: "Internal server error", success: false});
    }
}

export const toggleRedemptionStatus = async (req, res) => {
    try {
        if (req.user.user_access !== 'admin') {
            return res.status(403).json({ message: "Unauthorized", success: false });
        }

        const { userId, redemptionId } = req.body;
        if (!userId || !redemptionId) {
            return res.status(400).json({ message: "User ID and Redemption ID are required", success: false });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found", success: false });
        }

        const redemptionItem = user.redeemedItems.id(redemptionId);
        if (!redemptionItem) {
            return res.status(404).json({ message: "Redemption record not found", success: false });
        }

        redemptionItem.isProcessed = !redemptionItem.isProcessed;
        await user.save();

        return res.status(200).json({ 
            message: `Item marked as ${redemptionItem.isProcessed ? 'processed' : 'pending'}`, 
            success: true,
            isProcessed: redemptionItem.isProcessed
        });
    } catch (error) {
        console.log("Error in toggleRedemptionStatus:", error);
        return res.status(500).json({ message: "Internal server error", success: false });
    }
}

