import mongoose from 'mongoose';
import SplitGroup from '../models/splitGroup.model.js';
import PaymentTransaction from '../models/paymentTransaction.model.js';
import Split from '../models/split.model.js';
import SplitMember from '../models/splitMember.model.js';
import MonthlyStats from '../models/monthlyStats.model.js';
import Notification from '../models/notification.model.js';
import User from '../models/user.model.js';
import { clearCache } from '../middlewares/cache.middleware.js';

// Helper to get current month string 'YYYY-MM'
const getCurrentMonth = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export const recordPaymentTransaction = async (req, res) => {
    try {
        const { amount, merchantUpiId, merchantName, status, referenceId } = req.body;

        const transaction = new PaymentTransaction({
            user: req.user.id,
            amount: Number(amount),
            merchantUpiId,
            merchantName,
            status: status || 'success',
            referenceId
        });

        await transaction.save();

        res.status(201).json({ success: true, transaction });
    } catch (error) {
        console.error("Error recording payment:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const createSplit = async (req, res) => {
    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const { paymentTransactionId, amount, description, groupId, members } = req.body;
        // members: [{ debtor: userId, amount: Number }]

        if (!members || members.length === 0) {
            return res.status(400).json({ success: false, message: "No members provided for split" });
        }

        const split = new Split({
            payer: req.user.id,
            paymentTransaction: paymentTransactionId || null,
            amount: Number(amount),
            description,
            group: groupId || null,
            status: 'pending'
        });

        await split.save({ session });

        const currentMonth = getCurrentMonth();
        let totalOwedToPayer = 0;

        for (const member of members) {
            if (member.debtor.toString() === req.user.id.toString()) continue;

            const splitMember = new SplitMember({
                split: split._id,
                debtor: member.debtor,
                amount: Number(member.amount),
                status: 'pending'
            });

            await splitMember.save({ session });
            totalOwedToPayer += Number(member.amount);

            // Notify debtor
            const notification = new Notification({
                recipient: member.debtor,
                sender: req.user.id,
                type: 'split_request',
                commentText: `demands ₹${member.amount} for "${description}"`
            });
            await notification.save({ session });

            // Update debtor's monthly stats
            await MonthlyStats.findOneAndUpdate(
                { user: member.debtor, month: currentMonth },
                { $inc: { totalOwed: Number(member.amount) } },
                { upsert: true, new: true, session }
            );
        }

        // Update payer's monthly stats
        await MonthlyStats.findOneAndUpdate(
            { user: req.user.id, month: currentMonth },
            { $inc: { totalOwed: -totalOwedToPayer, totalPaid: Number(amount) } },
            { upsert: true, new: true, session }
        );

        await session.commitTransaction();
        session.endSession();

        // Clear user caches
        clearCache(req.user.id, '*').catch(() => { });
        members.forEach(m => clearCache(m.debtor, '*').catch(() => { }));

        res.status(201).json({ success: true, split });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Error creating split:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getPendingSplits = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const pendingDebts = await SplitMember.find({ debtor: req.user.id, status: 'pending' })
            .populate({
                path: 'split',
                populate: [
                    { path: 'payer', select: 'name username avatar upiId' },
                    { path: 'group', select: 'title' }
                ]
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await SplitMember.countDocuments({ debtor: req.user.id, status: 'pending' });

        res.status(200).json({
            success: true,
            pendingDebts,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        console.error("Error fetching pending splits:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const markSplitPaid = async (req, res) => {
    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const { id } = req.params; // SplitMember id
        const { paymentReference } = req.body;

        const splitMember = await SplitMember.findOne({ _id: id, debtor: req.user.id }).populate('split').session(session);

        if (!splitMember) {
            return res.status(404).json({ success: false, message: "Split record not found" });
        }

        if (splitMember.status === 'paid') {
            return res.status(400).json({ success: false, message: "Already paid" });
        }

        splitMember.status = 'paid';
        splitMember.paymentReference = paymentReference;
        splitMember.paidAt = new Date();
        await splitMember.save({ session });

        // Check if all members paid, if so mark split as settled
        const pendingMembers = await SplitMember.countDocuments({ split: splitMember.split._id, status: 'pending' }).session(session);
        if (pendingMembers === 0) {
            await Split.findByIdAndUpdate(splitMember.split._id, { status: 'settled' }, { session });
        }

        // Send notification to payer
        const notification = new Notification({
            recipient: splitMember.split.payer,
            sender: req.user.id,
            type: 'split_paid',
            commentText: `paid ₹${splitMember.amount} for ${splitMember.split.description}`
        });
        await notification.save({ session });

        // Update stats
        const currentMonth = getCurrentMonth();

        // Debtor stats
        await MonthlyStats.findOneAndUpdate(
            { user: req.user.id, month: currentMonth },
            { $inc: { totalOwed: -splitMember.amount, totalPaid: splitMember.amount } },
            { upsert: true, new: true, session }
        );

        // Payer stats (received money)
        await MonthlyStats.findOneAndUpdate(
            { user: splitMember.split.payer, month: currentMonth },
            { $inc: { totalOwed: splitMember.amount, totalReceived: splitMember.amount } },
            { upsert: true, new: true, session }
        );

        await session.commitTransaction();
        session.endSession();

        // Clear relevant caches
        clearCache(req.user.id, '*').catch(() => { });
        clearCache(splitMember.split.payer, '*').catch(() => { });

        res.status(200).json({ success: true, message: "Payment recorded successfully", splitMember });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Error marking split paid:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const createGroup = async (req, res) => {
    try {
        const { title, description, members } = req.body; // members is array of user IDs

        // Ensure creator is in members
        const finalMembers = members || [];
        if (!finalMembers.includes(req.user.id)) {
            finalMembers.push(req.user.id);
        }

        const group = new SplitGroup({
            title,
            description,
            creator: req.user.id,
            members: finalMembers
        });

        await group.save();

        clearCache(req.user.id, 'groups').catch(() => { });
        finalMembers.forEach(m => clearCache(m, 'groups').catch(() => { }));

        res.status(201).json({ success: true, group });
    } catch (error) {
        console.error("Error creating group:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getGroups = async (req, res) => {
    try {
        const groups = await SplitGroup.find({ members: req.user.id })
            .populate('members', 'name username avatar')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, groups });
    } catch (error) {
        console.error("Error fetching groups:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getMonthlyStats = async (req, res) => {
    try {
        let { month } = req.query; // YYYY-MM
        if (!month) {
            month = getCurrentMonth();
        }

        const stats = await MonthlyStats.findOne({ user: req.user.id, month });

        res.status(200).json({
            success: true,
            stats: stats || { totalPaid: 0, totalReceived: 0, totalOwed: 0, month }
        });
    } catch (error) {
        console.error("Error fetching monthly stats:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getCreatedSplits = async (req, res) => {
    try {
        const splits = await Split.find({ payer: req.user.id })
            .populate('group', 'title')
            .sort({ createdAt: -1 });

        const splitsWithMembers = await Promise.all(splits.map(async (split) => {
            const members = await SplitMember.find({ split: split._id }).populate('debtor', 'name username avatar');
            return {
                ...split.toObject(),
                members
            };
        }));

        res.status(200).json({ success: true, splits: splitsWithMembers });
    } catch (error) {
        console.error("Error fetching created splits:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const remindSplitMember = async (req, res) => {
    try {
        const { id } = req.params; // splitMember ID

        const splitMember = await SplitMember.findById(id).populate('split');
        if (!splitMember) {
            return res.status(404).json({ success: false, message: "Record not found" });
        }

        if (splitMember.status === 'paid') {
            return res.status(400).json({ success: false, message: "Already paid" });
        }

        const notification = new Notification({
            recipient: splitMember.debtor,
            sender: req.user.id,
            type: 'split_request',
            commentText: `demands ₹${splitMember.amount} for "${splitMember.split.description}"`
        });

        await notification.save();

        res.status(200).json({ success: true, message: "Reminder sent successfully" });
    } catch (error) {
        console.error("Error sending split reminder:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
