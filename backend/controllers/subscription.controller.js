import Razorpay from "razorpay";
import Subscription from "../models/subscription.model.js";
import { verifySignature } from "../utils/redeemOrder.js";
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

/**
 * Turn a pending subscription order into active time.
 *
 * Shared by the app's verify call and the Razorpay webhook, because the money
 * can be captured without the app ever getting to tell us — the student's
 * screen locks, the network drops, the process is killed. Whichever arrives
 * first activates; the claim is atomic, so the second one is a no-op.
 *
 * Returns the activated document, or null if it was already claimed.
 */
export const activateSubscription = async (subscription, razorpayPaymentId) => {
    const now = new Date();

    // Stack onto whatever is left rather than truncating it.
    const activeSub = await Subscription.findOne({
        user: subscription.user,
        status: 'active',
    }).sort({ endDate: -1 });

    const baseDate = activeSub?.endDate && activeSub.endDate > now ? new Date(activeSub.endDate) : now;
    const endDate = new Date(baseDate);
    endDate.setDate(endDate.getDate() + 30);

    const claimed = await Subscription.findOneAndUpdate(
        { _id: subscription._id, status: 'pending' },
        {
            $set: {
                razorpayPaymentId,
                status: 'active',
                startDate: baseDate,
                endDate,
            },
        },
        { new: true }
    );
    if (!claimed) return null;

    await User.findByIdAndUpdate(subscription.user, { is_subscribed: true });
    return claimed;
};

export const verifySubscriptionPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ success: false, message: "Missing payment details" });
        }

        if (!verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
            return res.status(400).json({ success: false, message: "Invalid payment signature" });
        }

        const subscription = await Subscription.findOne({
            razorpayOrderId: razorpay_order_id,
            user: req.user.id
        });
        if (!subscription) {
            return res.status(404).json({ success: false, message: "Subscription order not found" });
        }

        if (subscription.status !== 'pending') {
            return res.status(400).json({ success: false, message: "This payment has already been processed" });
        }

        // The signature only proves the ids came from Razorpay. Confirm the
        // money was actually captured, for the amount this order was created
        // at, before handing out a month of access.
        const payment = await razorpay.payments.fetch(razorpay_payment_id);
        const captured = payment.status === "captured" || payment.status === "authorized";
        const expectedPaise = Number(subscription.amount) * 100;
        if (!captured || String(payment.order_id) !== String(razorpay_order_id) || Number(payment.amount) !== expectedPaise) {
            return res.status(400).json({ success: false, message: "Payment not captured for the expected amount" });
        }

        const claimed = await activateSubscription(subscription, razorpay_payment_id);
        if (!claimed) {
            // The webhook beat us to it — the student is subscribed either way.
            return res.status(200).json({ success: true, message: "Subscription already active", alreadyProcessed: true });
        }

        res.status(200).json({ success: true, message: "Subscription activated!", subscription: claimed });
    } catch (err) {
        console.error("Error verifying subscription payment:", err);
        res.status(500).json({ success: false, message: "Error activating subscription" });
    }
};

export const getSubscriptionStatus = async (req, res) => {
    try{
        let config = await SystemConfig.findOne();
        if (config && config.isSubscriptionEnabled === false) {
            return res.status(200).json({
                success: true,
                status: 'active',
                isLifetime: true,
                message: "Subscriptions are globally disabled, app is free for all."
            });
        }

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
        }).sort({ endDate: -1 });

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
        if (!config) config = await SystemConfig.create({ subscriptionPrice: 39, isSubscriptionEnabled: true });
        
        res.status(200).json({ 
            success: true, 
            price: config.subscriptionPrice,
            isSubscriptionEnabled: config.isSubscriptionEnabled
        });
    } catch (err) {
        console.error("Error fetching config:", err);
        res.status(500).json({ success: false, message: "Error fetching config" });
    }
};

export const updateSubscriptionConfig = async (req, res) => {
    try {
        const { price, isSubscriptionEnabled } = req.body;
        if (!price || price < 1) {
             return res.status(400).json({ success: false, message: "Valid price is required" });
        }
        let config = await SystemConfig.findOne();
        if (!config) config = new SystemConfig();
        config.subscriptionPrice = Number(price);
        
        if (isSubscriptionEnabled !== undefined) {
            config.isSubscriptionEnabled = Boolean(isSubscriptionEnabled);
        }
        
        await config.save();
        
        res.status(200).json({ 
            success: true, 
            message: "Subscription config updated", 
            price: config.subscriptionPrice,
            isSubscriptionEnabled: config.isSubscriptionEnabled
        });
    } catch (err) {
        console.error("Error updating config:", err);
        res.status(500).json({ success: false, message: "Error updating config" });
    }
};
