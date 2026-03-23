import Bootcamp from "../../models/events/bootcamp.model.js";
import SpeakerSession from "../../models/events/createSpeakerSession.model.js";
import RegisterBootcamp from "../../models/events/registerBootcamp.model.js";
import RegisterSpeakerSession from "../../models/events/registerSpeakerSession.model.js";
import EventMessage from "../../models/events/eventMessage.model.js";
import User from "../../models/user.model.js";
import { uploadToCloudinary } from "../../utils/cloudinary.js"; // Assuming this exists
import QRCode from 'qrcode';

let io;
export const setEventCommunityIo = (socketIo) => {
    io = socketIo;
};

const getEventModel = (type) => {
    return type === 'Bootcamp' ? Bootcamp : SpeakerSession;
};

const getRegistrationModel = (type) => {
    return type === 'Bootcamp' ? RegisterBootcamp : RegisterSpeakerSession;
};

export const addSecondaryAdmin = async (req, res) => {
    try {
        const { eventId, type, username } = req.body; 
        const Model = getEventModel(type);
        
        const event = await Model.findById(eventId);
        if (!event) return res.status(404).json({ success: false, message: "Event not found" });

        const isPrimary = type === 'Bootcamp' 
            ? event.admin_email.toLowerCase() === req.user.email.toLowerCase() 
            : event.admin_email.toString() === req.user.id.toString();

        if (!isPrimary) {
            return res.status(403).json({ success: false, message: "Only the primary event creator can manage administrators" });
        }

        const userToAdd = await User.findOne({ username });
        if (!userToAdd) return res.status(404).json({ success: false, message: "User not found with this username" });

        const adminValue = userToAdd._id;
        
        const adminStrings = (event.secondaryAdmins || []).map(a => a.toString());
        if (!event.secondaryAdmins.some(a => a.toString() === adminValue.toString())) {
            event.secondaryAdmins.push(adminValue);
            await event.save();
        }
        
        // Automatically register the secondary admin for the event if not already registered
        const RegModel = getRegistrationModel(type);
        const existingReg = await RegModel.findOne({ eventId: event._id, userId: userToAdd._id });
        
        if (!existingReg) {
            let registrationData = {
                eventId: event._id,
                userId: userToAdd._id,
                isPaid: true // Admins receive complimentary access
            };

            if (type === 'Bootcamp') {
                const start = new Date(event.startDate);
                const end = new Date(event.endDate);
                const attendance = [];
                for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    attendance.push({ date: d.toISOString().split('T')[0], isPresent: true }); // Admins are always present
                }
                registrationData.attendance = attendance;
            }
            
            registrationData.isPresent = true; // For Speaker Sessions

            let registration = await RegModel.create(registrationData);

            const qrData = JSON.stringify({
                registrationId: registration._id,
                type: type.toLowerCase(),
                eventId: event.eventId,
                email: userToAdd.email,
                role: 'administrator'
            });
            registration.qrCode = await QRCode.toDataURL(qrData);
            await registration.save();
        }

        await event.populate('secondaryAdmins', 'name username avatar email');

        return res.status(200).json({ success: true, message: "Admin added successfully", secondaryAdmins: event.secondaryAdmins });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const removeSecondaryAdmin = async (req, res) => {
    try {
        const { eventId, type, adminValue } = req.body; 
        const Model = getEventModel(type);
        
        const event = await Model.findById(eventId);
        if (!event) return res.status(404).json({ success: false, message: "Event not found" });

        const isPrimary = type === 'Bootcamp' 
            ? event.admin_email.toLowerCase() === req.user.email.toLowerCase() 
            : event.admin_email.toString() === req.user.id.toString();

        if (!isPrimary) {
            return res.status(403).json({ success: false, message: "Only the primary event creator can manage administrators" });
        }

        event.secondaryAdmins = event.secondaryAdmins.filter(admin => admin.toString() !== adminValue.toString());
        await event.save();

        // Remove their complimentary registration since they are no longer an admin
        const RegModel = getRegistrationModel(type);
        await RegModel.deleteOne({ eventId: event._id, userId: adminValue });
        
        await event.populate('secondaryAdmins', 'name username avatar email');

        return res.status(200).json({ success: true, message: "Admin removed successfully", secondaryAdmins: event.secondaryAdmins });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getEventMessages = async (req, res) => {
    try {
        const { eventId, type } = req.params;
        
        // Check if user is registered or admin
        const RegModel = getRegistrationModel(type);
        const Model = getEventModel(type);
        
        const event = await Model.findById(eventId);
        if (!event) return res.status(404).json({ success: false, message: "Event not found" });

        const isRegistered = await RegModel.findOne({ eventId, userId: req.user.id });
        const isAdmin = (type === 'Bootcamp' 
            ? (event.admin_email.toLowerCase() === req.user.email.toLowerCase() || (event.secondaryAdmins || []).some(a => a.toString() === req.user.id.toString()))
            : (event.admin_email.toString() === req.user.id.toString() || (event.secondaryAdmins || []).some(a => a.toString() === req.user.id.toString()))
        );

        if (!isRegistered && !isAdmin) {
            return res.status(403).json({ success: false, message: "You must be registered to access the community" });
        }

        const messages = await EventMessage.find({ eventId, eventModel: type })
            .sort({ createdAt: 1 })
            .populate('sender', 'name avatar email username')
            .populate({
                path: 'replyTo',
                populate: { path: 'sender', select: 'name username' }
            });

        return res.status(200).json({ success: true, messages });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const sendEventMessage = async (req, res) => {
    try {
        const { eventId, type, text, replyTo } = req.body;
        const image = req.file?.path;
        
        const RegModel = getRegistrationModel(type);
        const Model = getEventModel(type);
        
        const event = await Model.findById(eventId);
        if (!event) return res.status(404).json({ success: false, message: "Event not found" });

        const isRegistered = await RegModel.findOne({ eventId, userId: req.user.id });
        const isAdmin = (type === 'Bootcamp' 
            ? (event.admin_email.toLowerCase() === req.user.email.toLowerCase() || (event.secondaryAdmins || []).some(a => a.toString() === req.user.id.toString()))
            : (event.admin_email.toString() === req.user.id.toString() || (event.secondaryAdmins || []).some(a => a.toString() === req.user.id.toString()))
        );

        if (!isRegistered && !isAdmin) {
            return res.status(403).json({ success: false, message: "Only participants can send messages" });
        }

        const message = await EventMessage.create({
            eventId,
            eventModel: type,
            sender: req.user.id,
            text,
            image,
            replyTo: replyTo || null
        });

        const populatedMessage = await message.populate([
            { path: 'sender', select: 'name avatar email username' },
            { 
                path: 'replyTo',
                populate: { path: 'sender', select: 'name username' }
            }
        ]);

        if (io) {
            io.to(`community_${eventId}`).emit('new_event_message', populatedMessage);
        }

        return res.status(200).json({ success: true, message: populatedMessage });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteEventMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const message = await EventMessage.findById(messageId);
        
        if (!message) return res.status(404).json({ success: false, message: "Message not found" });

        // Only allow sender OR event admin to delete
        const RegModel = getRegistrationModel(message.eventModel);
        const Model = getEventModel(message.eventModel);
        const event = await Model.findById(message.eventId);

        const isAdmin = (message.eventModel === 'Bootcamp' 
            ? (event.admin_email.toLowerCase() === req.user.email.toLowerCase() || (event.secondaryAdmins || []).some(a => a.toString() === req.user.id.toString()))
            : (event.admin_email.toString() === req.user.id.toString() || (event.secondaryAdmins || []).some(a => a.toString() === req.user.id.toString()))
        );

        if (message.sender.toString() !== req.user.id.toString() && !isAdmin) {
            return res.status(403).json({ success: false, message: "Unauthorized to delete this message" });
        }

        await EventMessage.findByIdAndDelete(messageId);

        if (io) {
            io.to(`community_${message.eventId}`).emit('event_message_deleted', { messageId });
        }

        return res.status(200).json({ success: true, message: "Message deleted successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
