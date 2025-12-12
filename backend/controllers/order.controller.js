import express from "express";
import Order from "../models/orders.model.js";

export const addOrder = async (req, res) => {
  try {
    const { amount, productId, olxId } = req.body;
    if (!amount || !productId || !olxId) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    const order = await Order.create({
      user: req.user.id,
      amount,
      productId,
      olxId
    }); 
    return res.status(200).json({ success: true, message: "Order created successfully", order });
  } catch (error) {
    console.log("Internal server error", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getAllOrder = async(req,res)=>{
    try {
        const user = req.user;
        if(!user){
            return res.status(400).json({ success: false, message: 'User not found, please login' });
        }
        const orders = await Order.findById(user.id);
        if(!orders){
            return res.status(404).json({ success: false, message: 'Orders not found' });
        }
        return res.status(200).json({ success: true, message: 'Orders fetched successfully', orders });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(400).json({message:"Internal server error", success:false});
    }
}