import Razorpay from "razorpay";
import crypto from "crypto";
import Subscription from "../models/subscription.model.js";
import User from "../models/user.model.js";
import SystemConfig from "../models/systemConfig.model.js";
import dotenv from "dotenv";

dotenv.config({quiet: true});

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const createSubscriptionOrder = async (req, res) => {
    try {
        const { amount } = req.body; // Amount in INR
        
        let config = await SystemConfig.findOne();
        if (!config) config = await SystemConfig.create({ subscriptionPrice: 39 });
        const currentPrice = config.subscriptionPrice;

        if (!amount || amount !== currentPrice) {
            return res.status(400).json({ success: false, message: `Invalid subscription amount. It should be ₹${currentPrice}.` });
        }

        const options = {
            amount: amount * 100, // Razorpay amount in paise
            currency: "INR",
            receipt: `sub_receipt_${Math.floor(Math.random() * 1000000)}`,
        };

        const order = await razorpay.orders.create(options);

        // Store pending subscription record
        await Subscription.create({
            user: req.user.id,
            razorpayOrderId: order.id,
            amount: amount,
            status: 'pending'
        });

        res.status(200).json({ success: true, order });
    } catch (err) {
        console.error("Error creating subscription order:", err);
        res.status(500).json({ success: false, message: "Error creating subscription order" });
    }
};

export const verifySubscriptionPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest("hex");

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ success: false, message: "Invalid payment signature" });
        }

        const subscription = await Subscription.findOne({ razorpayOrderId: razorpay_order_id });
        if (!subscription) {
            return res.status(404).json({ success: false, message: "Subscription order not found" });
        }

        if (subscription.status !== 'pending') {
            return res.status(400).json({ success: false, message: "This payment has already been processed" });
        }

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + 30); // 30 days access

        // Update subscription record securely
        subscription.razorpayPaymentId = razorpay_payment_id;
        subscription.status = 'active';
        subscription.startDate = startDate;
        subscription.endDate = endDate;
        await subscription.save();

        // Update user's is_subscribed status
        await User.findByIdAndUpdate(req.user.id, {
            is_subscribed: true
        });

        res.status(200).json({ success: true, message: "Subscription activated!", subscription });
    } catch (err) {
        console.error("Error verifying subscription payment:", err);
        res.status(500).json({ success: false, message: "Error activating subscription" });
    }
};

export const getSubscriptionStatus = async (req, res) => {
    try{
        const user = await User.findById(req.user.id);
        if (user && (user.user_access === 'recruiter' || user.user_access === 'admin')) {
            return res.status(200).json({
                success: true,
                status: 'active',
                isLifetime: true,
                message: "Admins and Recruiters have free lifetime access"
            });
        }

        const subscription = await Subscription.findOne({
            user: req.user.id,
            status: 'active'
        }).sort({ createdAt: -1 });

        if (!subscription) {
            return res.status(200).json({ success: true, status: 'inactive' });
        }

        // Handle legacy subscriptions where endDate might not be set
        let expirationDate = subscription.endDate;
        if (!expirationDate) {
            expirationDate = new Date(subscription.createdAt);
            expirationDate.setDate(expirationDate.getDate() + 30);
        }

        const now = new Date();
        if (now > expirationDate) {
            subscription.status = 'expired';
            subscription.endDate = expirationDate;
            await subscription.save();

            await User.findByIdAndUpdate(req.user.id, { is_subscribed: false });

            return res.status(200).json({ success: true, status: 'expired', subscription });
        }

        const daysRemaining = Math.ceil((new Date(expirationDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        res.status(200).json({
            success: true,
            status: 'active',
            daysRemaining,
            subscription
        });
    } catch (err) {
        console.error("Error getting subscription status:", err);
        res.status(500).json({ success: false, message: "Error fetching status" });
    }
};

export const getSubscriptionConfig = async (req, res) => {
    try {
        let config = await SystemConfig.findOne();
        if (!config) config = await SystemConfig.create({ subscriptionPrice: 39 });
        
        res.status(200).json({ success: true, price: config.subscriptionPrice });
    } catch (err) {
        console.error("Error fetching config:", err);
        res.status(500).json({ success: false, message: "Error fetching config" });
    }
};

export const updateSubscriptionConfig = async (req, res) => {
    try {
        const { price } = req.body;
        if (!price || price < 1) {
             return res.status(400).json({ success: false, message: "Valid price is required" });
        }
        let config = await SystemConfig.findOne();
        if (!config) config = new SystemConfig();
        config.subscriptionPrice = Number(price);
        await config.save();
        
        res.status(200).json({ success: true, message: "Subscription price updated", price: config.subscriptionPrice });
    } catch (err) {
        console.error("Error updating config:", err);
        res.status(500).json({ success: false, message: "Error updating config" });
    }
};
