import Razorpay from "razorpay";
import crypto from "crypto";
import Subscription from "../models/subscription.model.js";
import User from "../models/user.model.js";
import dotenv from "dotenv";

dotenv.config({quiet: true});

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const createSubscriptionOrder = async (req, res) => {
    try {
        const { amount } = req.body; // Amount in INR
        if (!amount || amount !== 39) {
            return res.status(400).json({ success: false, message: "Invalid subscription amount. It should be ₹39." });
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

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + 30); // 30 days access

        // Update subscription record
        const subscription = await Subscription.findOneAndUpdate(
            { razorpayOrderId: razorpay_order_id },
            {
                razorpayPaymentId: razorpay_payment_id,
                status: 'active',
                startDate,
                endDate
            },
            { new: true }
        );

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
        if (user && user.user_access === 'recruiter') {
            return res.status(200).json({
                success: true,
                status: 'active',
                isLifetime: true,
                message: "Recruiters have free lifetime access"
            });
        }

        const subscription = await Subscription.findOne({
            user: req.user.id,
            status: 'active'
        }).sort({ createdAt: -1 });

        if (!subscription) {
            return res.status(200).json({ success: true, status: 'inactive' });
        }

        const now = new Date();
        if (now > subscription.endDate) {
            subscription.status = 'expired';
            await subscription.save();

            await User.findByIdAndUpdate(req.user.id, { is_subscribed: false });

            return res.status(200).json({ success: true, status: 'expired', subscription });
        }

        const daysRemaining = Math.ceil((new Date(subscription.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

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
