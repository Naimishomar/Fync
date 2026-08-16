import Community from '../../models/community/community.model.js';
import SubCommunity from '../../models/community/subCommunity.model.js';
import CommunityMessage from '../../models/community/communityMessage.model.js';
import { deleteFromR2 } from '../../utils/r2.js';
import redis from '../../utils/redis.js';

const hasId = (arr, id) => Array.isArray(arr) && id != null && arr.some(x => String(x) === String(id));
const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let communityIo;
export const setCommunityIo = (io) => {
    communityIo = io;
};

export const createCommunity = async (req, res) => {
    try {
        const { name, description, socialLinks, plan } = req.body;
        const creatorId = req.user?.id || req.user?._id;
        if (!creatorId) {
            if (req.files?.logo?.[0]?.path) await deleteFromR2(req.files.logo[0].path);
            if (req.files?.banner?.[0]?.path) await deleteFromR2(req.files.banner[0].path);
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const logo = req.files?.logo?.[0]?.path;
        const banner = req.files?.banner?.[0]?.path;

        if (!name || !creatorId) {
            if (logo) await deleteFromR2(logo);
            if (banner) await deleteFromR2(banner);
            return res.status(400).json({ success: false, message: "Name and Creator ID are required" });
        }

        const existing = await Community.findOne({ name });
        if (existing) {
            if (logo) await deleteFromR2(logo);
            if (banner) await deleteFromR2(banner);
            return res.status(400).json({ success: false, message: "Community name already exists" });
        }

        let parsedSocial = {};
        if (socialLinks) {
            try { parsedSocial = typeof socialLinks === 'string' ? JSON.parse(socialLinks) : socialLinks; }
            catch(e) { console.log("Social parse error", e); }
        }

        // Expiry calculation
        const days = plan === 'yearly' ? 365 : 30;
        const expiryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

        const community = await Community.create({
            name,
            description,
            creator: creatorId,
            logo,
            banner,
            members: [creatorId],
            socialLinks: parsedSocial,
            subscription: {
                status: 'active',
                expiryDate,
                lastPaymentDate: new Date()
            }
        });

        // Create mandatory initial sub-communities
        await SubCommunity.create([
            {
                communityId: community._id,
                name: 'General',
                description: 'Main chat for everyone in ' + name,
                type: 'chat'
            },
            {
                communityId: community._id,
                name: 'Announcements 📢',
                description: 'Official updates from the hub',
                type: 'announcement'
            }
        ]);

        return res.status(201).json({ success: true, community });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const updateCommunity = async (req, res) => {
    try {
        const { communityId, name, description, socialLinks } = req.body;
        const userId = req.user?.id || req.user?._id;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
        const community = await Community.findById(communityId);
        if (!community) return res.status(404).json({ success: false, message: "Hub not found" });
        if (community.creator.toString() !== userId) return res.status(403).json({ success: false, message: "Denied" });

        if (name) community.name = name;
        if (description) community.description = description;

        if (socialLinks) {
            try { community.socialLinks = typeof socialLinks === 'string' ? JSON.parse(socialLinks) : socialLinks; }
            catch(e) { console.log("Social links sync error", e); }
        }

        if (req.files) {
            if (req.files.logo?.[0]) {
                if (community.logo) await deleteFromR2(community.logo);
                community.logo = req.files.logo[0].path;
            }
            if (req.files.banner?.[0]) {
                if (community.banner) await deleteFromR2(community.banner);
                community.banner = req.files.banner[0].path;
            }
        }

        await community.save();
        return res.status(200).json({ success: true, community });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteCommunity = async (req, res) => {
    try {
        const { communityId } = req.body;
        const userId = req.user?.id || req.user?._id;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
        const community = await Community.findById(communityId);
        if (!community) return res.status(404).json({ success: false, message: "Hub not found" });
        if (community.creator.toString() !== userId) return res.status(403).json({ success: false, message: "Denied" });

        // Clean hub assets
        if (community.logo) await deleteFromR2(community.logo);
        if (community.banner) await deleteFromR2(community.banner);

        // Sub-communities and their assets
        const subs = await SubCommunity.find({ communityId });
        for (const sub of subs) {
            if (sub.logo) await deleteFromR2(sub.logo);
            // Messages media
            const messages = await CommunityMessage.find({ subCommunityId: sub._id });
            for (const msg of messages) {
                if (msg.image) await deleteFromR2(msg.image);
                if (msg.video) await deleteFromR2(msg.video);
            }
            await CommunityMessage.deleteMany({ subCommunityId: sub._id });
        }

        await SubCommunity.deleteMany({ communityId });
        await community.deleteOne();

        return res.status(200).json({ success: true, message: "Hub permanently decommissioned" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getAllCommunities = async (req, res) => {
    try {
        const communities = await Community.find().populate('creator', 'name username avatar');
        return res.status(200).json({ success: true, communities });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getCommunityDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const community = await Community.findById(id).populate('creator', 'name username avatar');
        if (!community) return res.status(404).json({ success: false, message: "Community not found" });

        // Auto-suspend check
        if (community.subscription.status === 'active' && new Date() > new Date(community.subscription.expiryDate)) {
            community.subscription.status = 'suspended';
            await community.save();
        }

        const subCommunities = await SubCommunity.find({ communityId: id });
        const allCommunitiesByCreator = await Community.find({ creator: community.creator._id });

        return res.status(200).json({ 
            success: true, 
            community, 
            subCommunities,
            creatorOtherCommunities: allCommunitiesByCreator.filter(c => c._id.toString() !== id)
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const renewHubSubscription = async (req, res) => {
    try {
        const { communityId, plan } = req.body; // plan: 'monthly' or 'yearly'
        const userId = req.user?.id || req.user?._id;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
        const community = await Community.findById(communityId);
        if (!community) return res.status(404).json({ success: false, message: "Hub not found" });
        if (community.creator.toString() !== userId) return res.status(403).json({ success: false, message: "Denied" });

        const now = new Date();
        let newExpiry;
        const daysToAdd = plan === 'yearly' ? 365 : 30;
        
        // If still active, stack it. Else start from now.
        if (new Date(community.subscription.expiryDate) > now) {
            newExpiry = new Date(new Date(community.subscription.expiryDate).getTime() + daysToAdd * 24 * 60 * 60 * 1000);
        } else {
            newExpiry = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
        }

        community.subscription.expiryDate = newExpiry;
        community.subscription.status = 'active';
        community.subscription.lastPaymentDate = now;

        await community.save();
        return res.status(200).json({ success: true, message: `Hub Spark renewed (${plan === 'yearly' ? 'Yearly' : 'Monthly'})!`, expiry: newExpiry });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const joinCommunity = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id || req.user?._id;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
        const community = await Community.findById(id);
        if (!community) return res.status(404).json({ success: false, message: "Community not found" });

        if (hasId(community.members, userId)) {
            return res.status(400).json({ success: false, message: "Already a member" });
        }

        community.members.push(userId);
        await community.save();

        return res.status(200).json({ success: true, message: "Joined successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const leaveCommunity = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id || req.user?._id;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
        const community = await Community.findById(id);
        if (!community) return res.status(404).json({ success: false, message: "Hub not found" });

        // Creator cannot leave their own hub
        if (community.creator.toString() === userId) {
            return res.status(400).json({ success: false, message: "As creator, you must decommission rather than leave." });
        }

        community.members = community.members.filter(m => m.toString() !== userId);
        await community.save();

        return res.status(200).json({ success: true, message: "Successfully departed from hub" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const createSubCommunity = async (req, res) => {
    try {
        const { communityId, name, description, type } = req.body;
        const userId = req.user?.id || req.user?._id;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

        const community = await Community.findById(communityId);
        if (!community) return res.status(404).json({ success: false, message: "Hub not found" });

        const isCreator = String(community.creator) === String(userId);
        if (!isCreator && !hasId(community.members, userId)) {
            if (req.file?.path) await deleteFromR2(req.file.path);
            return res.status(403).json({ success: false, message: "Join the hub to create a room" });
        }

        const logo = req.file?.path;
        const subCommunity = await SubCommunity.create({ communityId, name, description, type, logo });
        return res.status(201).json({ success: true, subCommunity });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const updateSubCommunity = async (req, res) => {
    try {
        const { subId, name, description } = req.body;
        const userId = req.user?.id || req.user?._id;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
        const sub = await SubCommunity.findById(subId).populate('communityId');
        if (!sub) return res.status(404).json({ success: false, message: "Room not found" });
        if (sub.communityId.creator.toString() !== userId) return res.status(403).json({ success: false, message: "Denied" });

        if (name) sub.name = name;
        if (description) sub.description = description;

        if (req.file) {
            if (sub.logo) await deleteFromR2(sub.logo);
            sub.logo = req.file.path;
        }

        await sub.save();
        return res.status(200).json({ success: true, sub });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteSubCommunity = async (req, res) => {
    try {
        const { subId } = req.body;
        const userId = req.user?.id || req.user?._id;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
        const sub = await SubCommunity.findById(subId).populate('communityId');
        if (!sub) return res.status(404).json({ success: false, message: "Room not found" });
        if (sub.communityId.creator.toString() !== userId) return res.status(403).json({ success: false, message: "Denied" });

        if (sub.logo) await deleteFromR2(sub.logo);

        const messages = await CommunityMessage.find({ subCommunityId: subId });
        for (const msg of messages) {
            if (msg.image) await deleteFromR2(msg.image);
            if (msg.video) await deleteFromR2(msg.video);
        }

        await CommunityMessage.deleteMany({ subCommunityId: subId });
        await sub.deleteOne();

        // Clear Redis cache
        const cacheKey = `messages:${subId}`;
        await redis.del(cacheKey);

        return res.status(200).json({ success: true, message: "Room dissolved" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.body;
        const userId = req.user?.id || req.user?._id;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
        const message = await CommunityMessage.findById(messageId).populate({
            path: 'subCommunityId',
            populate: { path: 'communityId' }
        });
        if (!message) return res.status(404).json({ success: false, message: "Message not found" });

        const isCreator = message.subCommunityId.communityId.creator.toString() === userId;
        const isOwner = message.sender.toString() === userId;

        if (!isCreator && !isOwner) {
            return res.status(403).json({ success: false, message: "Not authorized to delete" });
        }

        if (message.image) await deleteFromR2(message.image);
        if (message.video) await deleteFromR2(message.video);
        
        const subId = message.subCommunityId._id.toString();
        await message.deleteOne();

        // Update Redis Cache
        const cacheKey = `messages:${subId}`;
        const cached = await redis.get(cacheKey);
        if (cached) {
            let messages = JSON.parse(cached);
            messages = messages.filter(m => m._id.toString() !== messageId);
            await redis.setEx(cacheKey, 3600, JSON.stringify(messages));
        }

        if (communityIo) {
            communityIo.to(subId).emit('message_deleted', { messageId, subId });
        }

        return res.status(200).json({ success: true, message: "Deleted successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const exportChatHistory = async (req, res) => {
    try {
        const { subId } = req.params;
        const messages = await CommunityMessage.find({ subCommunityId: subId })
            .populate('sender', 'name')
            .sort({ createdAt: 1 });

        let htmlContent = `<html><head><style>
            body { font-family: sans-serif; padding: 40px; background: #f9f9f9; }
            .msg { background: white; padding: 15px; border-radius: 10px; margin-bottom: 10px; border-left: 5px solid #6366f1; }
            .header { color: #6366f1; font-weight: bold; margin-bottom: 5px; font-size: 14px; }
            .time { font-size: 10px; color: #999; }
        </style></head><body><h1>Community Export</h1>`;

        messages.forEach(m => {
            htmlContent += `<div class="msg">
                <div class="header">${escapeHtml(m.sender?.name)} <span class="time">${escapeHtml(m.createdAt?.toLocaleString())}</span></div>
                <div>${escapeHtml(m.text) || "[Media]"}</div>
            </div>`;
        });

        htmlContent += `</body></html>`;
        res.setHeader('Content-Type', 'text/html');
        return res.send(htmlContent);
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getSubCommunityMessages = async (req, res) => {
    try {
        const { subId } = req.params;
        const cacheKey = `messages:${subId}`;

        // Check Redis Cache
        const cachedMessages = await redis.get(cacheKey);
        if (cachedMessages) {
            const sub = await SubCommunity.findById(subId);
            return res.status(200).json({ success: true, messages: JSON.parse(cachedMessages), sub, source: 'cache' });
        }

        const sub = await SubCommunity.findById(subId).populate('communityId');
        if (!sub) return res.status(404).json({ success: false, message: "Room not found" });
        
        if (sub.communityId.subscription.status === 'suspended') {
            return res.status(403).json({ success: false, message: "Hub access suspended. Await Spark renewal." });
        }

        const messages = await CommunityMessage.find({ subCommunityId: subId })
            .populate('sender', 'name username avatar')
            .populate({
                path: 'repliedTo',
                populate: { path: 'sender', select: 'name' }
            })
            .sort({ createdAt: -1 })
            .limit(100);
        
        const reversed = messages.reverse();
        
        // Cache in Redis for 1 hour
        await redis.setEx(cacheKey, 3600, JSON.stringify(reversed));

        return res.status(200).json({ success: true, messages: reversed, sub, source: 'db' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const postMessage = async (req, res) => {
    try {
        const { subCommunityId, text, repliedTo } = req.body;
        const senderId = req.user?.id || req.user?._id;
        if (!senderId) return res.status(401).json({ success: false, message: "Unauthorized" });

        const sub = await SubCommunity.findById(subCommunityId).populate('communityId');
        if (!sub) return res.status(404).json({ success: false, message: "Room not found" });

        if (sub.communityId.subscription.status === 'suspended') {
            return res.status(403).json({ success: false, message: "Hub is suspended. Renew activation to post." });
        }

        const isCreator = String(sub.communityId.creator) === String(senderId);
        const isMember = hasId(sub.communityId.members, senderId);
        if (!isCreator && !isMember) {
            return res.status(403).json({ success: false, message: "Join the hub to post" });
        }

        if (sub.type === 'announcement' && !isCreator) {
            return res.status(403).json({ success: false, message: "Only administrators can message in official channels" });
        }

        const message = await CommunityMessage.create({
            subCommunityId,
            sender: senderId,
            text,
            repliedTo
        });
        const populatedMessage = await message.populate([
            { path: 'sender', select: 'name username avatar' },
            { path: 'repliedTo', populate: { path: 'sender', select: 'name' } }
        ]);

        // Update Redis Cache
        const cacheKey = `messages:${subCommunityId}`;
        const cached = await redis.get(cacheKey);
        if (cached) {
            let messages = JSON.parse(cached);
            messages.push(populatedMessage);
            if (messages.length > 100) messages.shift();
            await redis.setEx(cacheKey, 3600, JSON.stringify(messages));
        }

        // Socket Emission
        if (communityIo) {
            communityIo.to(subCommunityId).emit('new_message', populatedMessage);
        }

        return res.status(201).json({ success: true, message: populatedMessage });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
