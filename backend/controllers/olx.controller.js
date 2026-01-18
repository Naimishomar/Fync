import express from 'express';
import OLX from '../models/olx.model.js';
import User from '../models/user.model.js';

export const sellProduct = async(req,res)=>{
    try {
        const { product_name, product_description, product_type, price } = req.body;
        if(!product_name || !product_description || !product_type || !price){
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        else{
            const user = await User.findById(req.user.id);
            if(!user){
                return res.status(400).json({ success: false, message: 'User not found' });
            }
            let product_image = [];
            if (req.files && req.files.length > 0) {
                product_image = req.files.map(file => file.path);
            }
            const sellingProduct = await OLX.create({
                product_name,
                product_description,
                product_image,
                product_type,
                price,
                is_selled: false,
                seller: req.user.id,
                buyer: null,
                college: req.user.college
            })
            return res.status(200).json({ success: true, message: 'Product created successfully', product: sellingProduct });
        }
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const listedProductsByUser = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found, please login" });
        }
        const products = await OLX.find({ seller: req.user.id })
        .populate("seller", "name avatar username")
        .populate("buyer", "name avatar username");
        return res.status(200).json({ success: true, message: "Products fetched successfully", products });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const updateProduct = async(req,res)=>{
    try {
        const { product_name, product_description, product_type, price } = req.body;
        const product = await OLX.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }
        if (product.seller.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        else{
            let product_image = [];
            if (req.files && req.files.length > 0) {
                product_image = req.files.map(file => file.path);
            }
            const updatedProduct = await OLX.findByIdAndUpdate(
                req.params.id,
                {
                    $set: {
                        ...(product_name && { product_name }),
                        ...(product_description && { product_description }),
                        ...(product_image.length > 0 && { product_image }),
                        ...(product_type && { product_type }),
                        ...(price && { price }),
                    },
                },
                { new: true, runValidators: true }
            ).populate("seller");
            return res.status(200).json({ success: true, message: "Product updated successfully", product: updatedProduct });
        }
    } catch (error) {
       console.log("Internal server error", error);
       return res.status(500).json({ success: false, message: "Internal server error" });  
    }
}

export const deleteProduct = async(req,res)=>{
    try {
        const product = await OLX.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }
        if (product.seller.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        else{
            const deletedProduct = await OLX.findByIdAndDelete(req.params.id);
            return res.status(200).json({ success: true, message: "Product deleted successfully", product: deletedProduct });
        }
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
} 

export const getAllProducts = async(req,res)=>{
    try {
        const products = await OLX.find({ college: req.user.college })
        .populate("seller", "name avatar username")
        .sort({ createdAt: -1 })
        if(!products){
            return res.status(404).json({ success: false, message: 'Products not found' });
        }
        return res.status(200).json({ success: true, message: 'Products fetched successfully', products });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const detailsOfParticularProduct = async(req,res)=>{
    try {
        const {product_id} = req.params;
        if(!product_id){
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        const product = await OLX.findById(product_id).populate("seller", "name avatar username");
        if(!product){
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        return res.status(200).json({ success: true, message: 'Product fetched successfully', product });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}