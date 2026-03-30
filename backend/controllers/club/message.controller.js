import Club from '../../models/club/club.model.js';
import SubGroup from '../../models/club/subGroup.model.js';
import ClubMessage from '../../models/club/clubMessage.model.js';
import redis from '../../utils/redis.js';
import { uploadToR2, deleteFromR2 } from '../../utils/r2.js';
import mongoose from 'mongoose';

let clubIo;
export const setClubIo = (io) => {
    clubIo = io;
};

export const postClubMessage = async (req, res) => {
    try {
        const { subGroupId, senderId, text, repliedTo, isPoll, pollQuestion, pollOptions } = req.body;
        
        const subGroup = await SubGroup.findById(subGroupId).populate('clubId');
        const isSubAdmin = subGroup.admins.includes(senderId);
        const isMember = subGroup.members.includes(senderId);

        if (!isMember && !isClubAdmin) {
            return res.status(403).json({ success: false, message: "Join the group to chat" });
        }

        // Announcement check (Locked room) - Strict Boolean Force
        const isLocked = subGroup.onlyAdminsCanMessage === true || subGroup.onlyAdminsCanMessage === 'true';
        if (isLocked && !isClubAdmin && !isSubAdmin) {
            return res.status(403).json({ success: false, message: "This room is currently in Announcement Mode. Only Admins can post." });
        }

        let fileUrl = null;
        let fileType = null;
        let fileName = null;

        if (req.file) {
            fileUrl = await uploadToR2(req.file.buffer, 'club/messages', req.file.originalname, req.file.mimetype);
            fileName = req.file.originalname;
            if (req.file.mimetype.startsWith('image/')) fileType = 'image';
            else if (req.file.mimetype.startsWith('video/')) fileType = 'video';
            else if (req.file.mimetype === 'application/pdf') fileType = 'pdf';
            else fileType = 'doc';
        }

        const message = await ClubMessage.create({
            subGroupId,
            sender: senderId,
            text,
            repliedTo,
            fileUrl,
            fileType,
            fileName,
            isPoll: isPoll === 'true' || isPoll === true,
            pollQuestion,
            pollOptions: pollOptions ? (typeof pollOptions === 'string' ? JSON.parse(pollOptions) : pollOptions) : []
        });

        const populated = await message.populate([
            { path: 'sender', select: 'name username avatar' },
            { path: 'repliedTo', populate: { path: 'sender', select: 'name' } }
        ]);

        // Cache update
        const cacheKey = `club_messages:${subGroupId}`;
        const cached = await redis.get(cacheKey);
        if (cached) {
            let messages = JSON.parse(cached);
            messages.push(populated);
            if (messages.length > 50) messages.shift();
            await redis.setEx(cacheKey, 3600, JSON.stringify(messages));
        }

        if (clubIo) {
            clubIo.to(subGroupId).emit('new_club_message', populated);
        }

        return res.status(201).json({ success: true, message: populated });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getClubMessages = async (req, res) => {
    try {
        const { subGroupId } = req.params;
        const cacheKey = `club_messages:${subGroupId}`;

        const cached = await redis.get(cacheKey);
        if (cached) return res.status(200).json({ success: true, messages: JSON.parse(cached), source: 'cache' });

        const messages = await ClubMessage.find({ subGroupId })
            .populate('sender', 'name username avatar')
            .populate({ path: 'repliedTo', populate: { path: 'sender', select: 'name' } })
            .sort({ createdAt: -1 })
            .limit(50);

        const sorted = messages.reverse();
        const subGroup = await SubGroup.findById(subGroupId);
        await redis.setEx(cacheKey, 3600, JSON.stringify(sorted));

        return res.status(200).json({ success: true, messages: sorted, subGroup, source: 'db' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const voteInPoll = async (req, res) => {
    try {
        const { messageId, optionIndex, userId } = req.body;

        // Intelligent Connection Wait (Max 5s)
        let waitAttempts = 0;
        while (mongoose.connection.readyState !== 1 && waitAttempts < 10) {
            console.log(`📡 DB buffering (State ${mongoose.connection.readyState})... Attempt ${waitAttempts + 1}`);
            await new Promise(resolve => setTimeout(resolve, 500));
            waitAttempts++;
        }

        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ success: false, message: "Database connection flickering. Please try again in a moment." });
        }

        if (!mongoose.Types.ObjectId.isValid(messageId)) {
            return res.status(400).json({ success: false, message: "Invalid message ID" });
        }

        const message = await ClubMessage.findById(messageId).populate('subGroupId');
        if (!message || !message.isPoll) return res.status(404).json({ success: false, message: "Poll not found" });

        // Member Check
        const subGroup = await SubGroup.findById(message.subGroupId._id).populate('clubId');
        const isMember = subGroup.members.includes(userId) || subGroup.clubId.admins.includes(userId);
        if (!isMember) return res.status(403).json({ success: false, message: "Only room members can vote" });

        // Remove previous votes in this poll
        message.pollOptions.forEach(opt => {
            opt.votes = opt.votes.filter(id => id.toString() !== userId);
        });

        // Add new vote
        message.pollOptions[optionIndex].votes.push(userId);
        await message.save();

        // Invalidate Cache for consistency
        const cacheKey = `club_messages:${message.subGroupId._id}`;
        await redis.del(cacheKey);

        if (clubIo) {
            clubIo.to(message.subGroupId._id.toString()).emit('poll_updated', { messageId, pollOptions: message.pollOptions });
        }

        return res.status(200).json({ success: true, pollOptions: message.pollOptions });
    } catch (error) {
        console.error("Poll Vote Error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const togglePinMessage = async (req, res) => {
    try {
        const { messageId, adminId } = req.body;
        const message = await ClubMessage.findById(messageId).populate('subGroupId');
        
        // Authorization check (Club Admin or Sub-Admin)
        const sub = await SubGroup.findById(message.subGroupId._id).populate('clubId');
        const isAuthorized = sub.admins.includes(adminId) || sub.clubId.admins.includes(adminId);
        if (!isAuthorized) return res.status(403).json({ success: false, message: "Unauthorized" });

        message.isPinned = !message.isPinned;
        await message.save();

        // Update SubGroup pinned list
        if (message.isPinned) {
            await SubGroup.findByIdAndUpdate(sub._id, { $addToSet: { pinnedMessages: messageId } });
        } else {
            await SubGroup.findByIdAndUpdate(sub._id, { $pull: { pinnedMessages: messageId } });
        }

        // Invalidate Cache for consistency
        const cacheKey = `club_messages:${sub._id}`;
        await redis.del(cacheKey);

        return res.status(200).json({ success: true, isPinned: message.isPinned });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
