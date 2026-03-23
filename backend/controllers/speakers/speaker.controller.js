import CreateSpeakerSession from "../../models/events/createSpeakerSession.model.js";
import Speaker from "../../models/events/speakers.model.js";
import RegisterSpeakerSession from "../../models/events/registerSpeakerSession.model.js";
import { customAlphabet } from "nanoid";
import QRCode from "qrcode"; 
import { deleteFromCloudinary } from "../../utils/cloudinary.js";
import Razorpay from "razorpay";
import dotenv from "dotenv";
dotenv.config({ silent: true });

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});


export const createSpeakerSession = async(req,res)=>{
    try {
        const { admin_email, eventName, description, college, venue, date, startTime, endTime, userLimit, agenda, fee, admin_upi_id, isCollegeSpecific, isCommunityActive } = req.body;
        let contactDetails = req.body.contactDetails;
        if (typeof contactDetails === 'string') {
            try {
                contactDetails = JSON.parse(contactDetails);
            } catch (e) {
                contactDetails = [];
            }
        }
        
        const logo = req.files?.logo?.[0]?.path;
        const banner = req.files?.banner?.[0]?.path;

        if(!admin_email || !eventName || !description || !college || !venue || !date || !startTime || !endTime || userLimit === undefined || fee === undefined){
            if (logo) await deleteFromCloudinary(logo);
            if (banner) await deleteFromCloudinary(banner);
            return res.status(400).json({success: false, message: "Required all fields"});
        }

        if (fee > 0 && !admin_upi_id) {
            if (logo) await deleteFromCloudinary(logo);
            if (banner) await deleteFromCloudinary(banner);
            return res.status(400).json({success: false, message: "UPI ID is mandatory for paid events"});
        }

        const nanoidNumbers = customAlphabet('0123456789', 5);
        const eventId = nanoidNumbers();

        const speakerSession = await CreateSpeakerSession.create({
            eventId,
            admin_email,
            eventName,
            description,
            college,
            venue,
            date,
            startTime,
            endTime,
            userLimit,
            agenda,
            fee,
            admin_upi_id,
            isCollegeSpecific: isCollegeSpecific === 'true' || isCollegeSpecific === true,
            isCommunityActive: isCommunityActive === 'true' || isCommunityActive === true || isCommunityActive === undefined,
            logo,
            banner,
            status: 'open', // Default to open
            contactDetails: contactDetails || []
        })

        // Auto-register the primary admin with a complimentary pass
        let registration = await RegisterSpeakerSession.create({
            eventId: speakerSession._id,
            userId: admin_email, // admin_email stores the user's ObjectId for speaker sessions
            isPaid: true,
            isPresent: true, // Primary admin is always present
            qrCode: "pending"
        });

        const qrData = JSON.stringify({
            registrationId: registration._id,
            type: 'speaker_session',
            eventId: speakerSession.eventId,
            role: 'administrator'
        });
        registration.qrCode = await QRCode.toDataURL(qrData);
        await registration.save();

        return res.status(200).json({ success: true, message: "Speaker session created successfully", speakerSession });
    } catch (error) {
        if (req.files?.logo?.[0]?.path) await deleteFromCloudinary(req.files.logo[0].path);
        if (req.files?.banner?.[0]?.path) await deleteFromCloudinary(req.files.banner[0].path);
        return res.status(400).json({ success: false, message: error.message || "Internal server error" })
    }
}

export const getAllSpeakerSession = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Auto-delete expired sessions
        const now = new Date();
        const allSessions = await CreateSpeakerSession.find();
        const expiredIds = [];

        allSessions.forEach(session => {
            try {
                const eventDate = new Date(session.date);
                const [timePart, modifier] = session.endTime.split(' ');
                let [hours, minutes] = timePart.split(':').map(Number);
                if (modifier === 'PM' && hours !== 12) hours += 12;
                if (modifier === 'AM' && hours === 12) hours = 0;
                eventDate.setHours(hours, minutes, 0, 0);
                
                if (eventDate < now) {
                    expiredIds.push(session.eventId);
                }
            } catch (e) {
                console.error("Time parsing error for session:", session.eventId);
            }
        });

        if (expiredIds.length > 0) {
            await CreateSpeakerSession.deleteMany({ eventId: { $in: expiredIds } });
        }

        // Return open sessions OR any sessions where the user is the admin
        const sessions = await CreateSpeakerSession.find({ 
            $or: [
                { 
                    status: 'open',
                    $or: [
                        { isCollegeSpecific: false },
                        { isCollegeSpecific: true, college: req.user.college }
                    ]
                },
                { admin_email: req.user.id }
            ]
        })
            .sort({ date: 1 })
            .skip(skip)
            .limit(limit)
            .populate('speakers')
            .populate('secondaryAdmins', 'name username avatar email');

        if(!sessions){
            return res.status(404).json({success: false, message: "Speaker session not found"});
        }

        // Add registrationsCount to each session
        const sessionsWithCount = await Promise.all(sessions.map(async (s) => {
            const count = await RegisterSpeakerSession.countDocuments({ eventId: s._id });
            const sessionObj = s.toObject ? s.toObject() : s;
            sessionObj.registrationsCount = count;
            return sessionObj;
        }));

        return res.status(200).json({ 
            success: true, 
            message: "Speaker sessions fetched successfully", 
            sessions: sessionsWithCount,
            hasMore: sessions.length === limit 
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || "Internal server error" })
    }
}

export const getCollegeSpeakerSession = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Auto-delete expired sessions (already handled in general call but safe to keep here)
        const now = new Date();
        const allSessions = await CreateSpeakerSession.find({ college: req.user.college });
        const expiredIds = [];

        allSessions.forEach(session => {
            try {
                const eventDate = new Date(session.date);
                const [timePart, modifier] = session.endTime.split(' ');
                let [hours, minutes] = timePart.split(':').map(Number);
                if (modifier === 'PM' && hours !== 12) hours += 12;
                if (modifier === 'AM' && hours === 12) hours = 0;
                eventDate.setHours(hours, minutes, 0, 0);

                if (eventDate < now) expiredIds.push(session.eventId);
            } catch (e) {}
        });

        if (expiredIds.length > 0) {
            await CreateSpeakerSession.deleteMany({ eventId: { $in: expiredIds } });
        }

        const sessions = await CreateSpeakerSession.find({ 
            college: req.user.college,
            $or: [
                { status: 'open' },
                { admin_email: req.user.id }
            ]
        })
            .sort({ date: 1 })
            .skip(skip)
            .limit(limit)
            .populate('speakers')
            .populate('secondaryAdmins', 'name username avatar email');

        if(!sessions){
            return res.status(404).json({success: false, message: "Speaker session not found"});
        }

        const sessionsWithCount = await Promise.all(sessions.map(async (s) => {
            const count = await RegisterSpeakerSession.countDocuments({ eventId: s._id });
            const sessionObj = s.toObject ? s.toObject() : s;
            sessionObj.registrationsCount = count;
            return sessionObj;
        }));

        return res.status(200).json({ 
            success: true, 
            message: "Speaker sessions fetched successfully", 
            sessions: sessionsWithCount,
            hasMore: sessions.length === limit
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || "Internal server error" })
    }
}

export const registerSpeakerSession = async(req,res)=>{
    try {
        const { eventId } = req.body;
        if(!eventId){
            return res.status(400).json({success: false, message: "Event ID is required"});
        }
        
        const session = await CreateSpeakerSession.findOne({ eventId });
        if (!session) {
            return res.status(404).json({ success: false, message: "Speaker session not found" });
        }

        const isAdmin = session.admin_email.toString() === req.user.id || session.secondaryAdmins.includes(req.user.id);
        if (isAdmin) {
            return res.status(400).json({ success: false, message: "Organizers have full access and do not need to register." });
        }

        // Check participation limit
        const registeredCount = await RegisterSpeakerSession.countDocuments({ eventId: session._id });
        if (session.userLimit && registeredCount >= session.userLimit) {
            return res.status(400).json({ success: false, message: "Participation limit reached for this session" });
        }

        if (session.isCollegeSpecific && session.college !== req.user.college) {
            return res.status(403).json({ success: false, message: `This event is restricted to ${session.college} students` });
        }

        const existingRegistration = await RegisterSpeakerSession.findOne({ 
            eventId: session._id, 
            userId: req.user.id 
        });

        if (existingRegistration) {
            if (existingRegistration.isPaid) {
                return res.status(400).json({ success: false, message: "You are already registered for this session" });
            }
            // Payment was never completed. Delete and start fresh so the user can re-register.
            await RegisterSpeakerSession.deleteOne({ _id: existingRegistration._id });
        }

        let registration = await RegisterSpeakerSession.create({
            eventId: session._id,
            userId: req.user.id,
            isPaid: session.fee === 0 ? true : false,
            qrCode: "pending" // Placeholder
        })

        const qrData = JSON.stringify({
            registrationId: registration._id,
            eventId: session.eventId,
            email: req.user.email,
        });
        const qrCode = await QRCode.toDataURL(qrData);
        
        registration.qrCode = qrCode;
        await registration.save();

        let order = null;
        if (session.fee > 0) {
            const options = {
                amount: session.fee * 100,
                currency: "INR",
                receipt: `speaker_reg_${registration._id}`,
                notes: {
                    type: 'speaker_session',
                    registrationId: registration._id,
                    eventId: session.eventId,
                    userId: req.user.id
                }
            };
            order = await razorpay.orders.create(options);
        }

        return res.status(200).json({ 
            success: true, 
            message: "Registered for speaker session successfully", 
            registration, 
            order,
            admin_upi_id: session.admin_upi_id, 
            fee: session.fee 
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || "Internal server error" })
    }
}

export const deleteRegistration = async (req, res) => {
    try {
        const { id } = req.params;
        await RegisterSpeakerSession.findOneAndDelete({ _id: id, userId: req.user.id });
        return res.status(200).json({ success: true, message: "Registration cancelled" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

export const getUserSpeakerSessions = async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Get speaker sessions where the user is a primary or secondary admin
        const adminSessions = await CreateSpeakerSession.find({
            $or: [
                { admin_email: userId },
                { secondaryAdmins: userId }
            ]
        }).populate('speakers');

        // 2. Get registered speaker sessions (Only show paid ones in the registry)
        const registrations = await RegisterSpeakerSession.find({ userId, isPaid: true })
            .populate({
                path: 'eventId',
                populate: { path: 'speakers' }
            })
            .sort({ createdAt: -1 });

        // Filter out admin sessions where the user already has a genuine RegisterSpeakerSession entry
        const unrecordedAdminSessions = adminSessions.filter(s => {
            return !registrations.some(r => r.eventId?._id?.toString() === s._id.toString());
        });

        // Automatically create permanent RegisterSpeakerSession records for admins who are missing them
        const adminAsRegistrations = await Promise.all(unrecordedAdminSessions.map(async s => {
            let registration = await RegisterSpeakerSession.create({
                eventId: s._id,
                userId: userId,
                isPaid: true,
                isPresent: true, // Admins always present
                qrCode: "pending" 
            });

            const qrData = JSON.stringify({
                registrationId: registration._id,
                type: 'speaker_session',
                eventId: s.eventId,
                email: req.user.email,
                role: 'administrator'
            });
            registration.qrCode = await QRCode.toDataURL(qrData);
            await registration.save();
            
            // Re-fetch or populate to match expected structure
            const populated = await RegisterSpeakerSession.findById(registration._id).populate({
                path: 'eventId',
                populate: { path: 'speakers' }
            });
            return populated;
        }));

        let combined = [...adminAsRegistrations, ...registrations];
        
        // Filter out registrations for deleted events
        combined = combined.filter(r => r.eventId !== null);

        return res.status(200).json({ 
            success: true, 
            message: "User sessions fetched successfully", 
            sessions: combined,
            registrations: combined // compatibility
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || "Internal server error" })
    }
}

export const addSpeakerToSession = async(req,res)=>{
    try {
        const { eventId, name, designation } = req.body;
        const image = req.file?.path;

        if(!eventId || !name || !designation || !image){
            if (image) await deleteFromCloudinary(image);
            return res.status(400).json({success: false, message: "Required all fields including speaker image"});
        }

        const session = await CreateSpeakerSession.findOne({ eventId });
        if(!session){
            await deleteFromCloudinary(image);
            return res.status(404).json({success: false, message: "Speaker session not found"});
        }

        // Verify admin
        if(req.user.id.toString() !== session.admin_email.toString()){
            await deleteFromCloudinary(image);
            return res.status(403).json({success: false, message: "You are not authorized to add speakers to this session"});
        }

        const speaker = await Speaker.create({
            eventId: session._id,
            name,
            designation,
            image
        });

        session.speakers.push(speaker._id);
        await session.save();

        return res.status(200).json({ success: true, message: "Speaker added successfully", speaker });
    } catch (error) {
        if (req.file?.path) await deleteFromCloudinary(req.file.path);
        return res.status(500).json({ success: false, message: error.message || "Internal server error" })
    }
}

export const updateSpeakerSession = async(req,res)=>{
    try {
        const { eventId, eventName, description, college, venue, date, startTime, endTime, userLimit, agenda, fee, admin_upi_id, status, isCollegeSpecific, isCommunityActive } = req.body;
        let contactDetails = req.body.contactDetails;
        if (typeof contactDetails === 'string') {
            try {
                contactDetails = JSON.parse(contactDetails);
            } catch (e) {
                contactDetails = undefined;
            }
        }
        
        if(!eventId){
            return res.status(400).json({success: false, message: "Event ID is required"});
        }

        const speakerSession = await CreateSpeakerSession.findOne({eventId});
        if(!speakerSession){
            return res.status(404).json({success: false, message: "Speaker session not found"});
        }

        if(!speakerSession.admin_email || req.user.id.toString() !== speakerSession.admin_email.toString()){
            return res.status(403).json({success: false, message: "You are not authorized to update this speaker session"});
        }

        const logo = req.files?.logo?.[0]?.path;
        const banner = req.files?.banner?.[0]?.path;

        if (logo && speakerSession.logo) await deleteFromCloudinary(speakerSession.logo);
        if (banner && speakerSession.banner) await deleteFromCloudinary(speakerSession.banner);

        const updatedSpeakerSession = await CreateSpeakerSession.findOneAndUpdate(
            { eventId },
            {
                $set: {
                    ...(eventName !== undefined && { eventName }),
                    ...(description !== undefined && { description }),
                    ...(college !== undefined && { college }),
                    ...(venue !== undefined && { venue }),
                    ...(date !== undefined && { date }),
                    ...(startTime !== undefined && { startTime }),
                    ...(endTime !== undefined && { endTime }),
                    ...(userLimit !== undefined && { userLimit }),
                    ...(agenda !== undefined && { agenda }),  
                    ...(fee !== undefined && { fee }),
                    ...(admin_upi_id !== undefined && { admin_upi_id }),
                    ...(status !== undefined && { status }),
                    ...(logo !== undefined && { logo }),
                    ...(banner !== undefined && { banner }),
                    ...(isCollegeSpecific !== undefined && { isCollegeSpecific: isCollegeSpecific === 'true' || isCollegeSpecific === true }),
                    ...(isCommunityActive !== undefined && { isCommunityActive: isCommunityActive === 'true' || isCommunityActive === true }),
                    ...(contactDetails !== undefined && { contactDetails }),
                }
            },
            { new: true, runValidators: true }
        );
        return res.status(200).json({ success: true, message: "Speaker session updated successfully", speakerSession: updatedSpeakerSession });
    } catch (error) {
        if (req.files?.logo?.[0]?.path) await deleteFromCloudinary(req.files.logo[0].path);
        if (req.files?.banner?.[0]?.path) await deleteFromCloudinary(req.files.banner[0].path);
        return res.status(500).json({ success: false, message: error.message || "Internal server error" })
    }
}

export const deleteSpeakerSession = async(req,res)=>{
    try {
        const { eventId } = req.body;
        if(!eventId){
            return res.status(400).json({success: false, message: "Event ID is required"});
        }

        const session = await CreateSpeakerSession.findOne({ eventId });
        if(!session){
            return res.status(404).json({success: false, message: "Speaker session not found"});
        }

        if(!session.admin_email || req.user.id.toString() !== session.admin_email.toString()){
            return res.status(403).json({success: false, message: "Unauthorized to delete this session"});
        }

        // Cleanup related data
        if (session.logo) await deleteFromCloudinary(session.logo);
        if (session.banner) await deleteFromCloudinary(session.banner);

        // Delete all speakers related to this session and their images
        const speakers = await Speaker.find({ eventId: session._id });
        for (const spk of speakers) {
            if (spk.image) await deleteFromCloudinary(spk.image);
            await Speaker.deleteOne({ _id: spk._id });
        }

        // Delete all registrations
        await RegisterSpeakerSession.deleteMany({ eventId: session._id });

        // Finally delete the session
        await CreateSpeakerSession.deleteOne({ eventId });

        return res.status(200).json({ success: true, message: "Speaker session and related data purged successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || "Internal server error" })
    }
}

export const updateSpeaker = async(req,res)=>{
    try {
        const { speakerId, name, designation } = req.body;
        const image = req.file?.path;

        if(!speakerId){
            if (image) await deleteFromCloudinary(image);
            return res.status(400).json({success: false, message: "Speaker ID is required"});
        }

        const speaker = await Speaker.findById(speakerId).populate('eventId');
        if(!speaker){
            if (image) await deleteFromCloudinary(image);
            return res.status(404).json({success: false, message: "Speaker not found"});
        }

        // speaker.eventId here is the full session object because of populate
        if(!speaker.eventId || !speaker.eventId.admin_email || req.user.id.toString() !== speaker.eventId.admin_email.toString()){
            if (image) await deleteFromCloudinary(image);
            return res.status(403).json({success: false, message: "Unauthorized to update this speaker"});
        }

        if (image && speaker.image) await deleteFromCloudinary(speaker.image);

        speaker.name = name || speaker.name;
        speaker.designation = designation || speaker.designation;
        if (image) speaker.image = image;

        await speaker.save();

        return res.status(200).json({ success: true, message: "Speaker updated successfully", speaker });
    } catch (error) {
        if (req.file?.path) await deleteFromCloudinary(req.file.path);
        return res.status(500).json({ success: false, message: error.message || "Internal server error" })
    }
}

export const deleteSpeaker = async(req,res)=>{
    try {
        const { speakerId } = req.body;
        if(!speakerId){
            return res.status(400).json({success: false, message: "Speaker ID is required"});
        }

        const speaker = await Speaker.findById(speakerId).populate('eventId');
        if(!speaker){
            return res.status(404).json({success: false, message: "Speaker not found"});
        }

        if(!speaker.eventId || !speaker.eventId.admin_email || req.user.id.toString() !== speaker.eventId.admin_email.toString()){
            return res.status(403).json({success: false, message: "Unauthorized to delete this speaker"});
        }

        if (speaker.image) await deleteFromCloudinary(speaker.image);
        
        // Remove speaker from session's speakers array
        await CreateSpeakerSession.updateOne(
            { _id: speaker.eventId._id },
            { $pull: { speakers: speakerId } }
        );
        
        await Speaker.deleteOne({ _id: speakerId });

        return res.status(200).json({ success: true, message: "Speaker removed successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || "Internal server error" })
    }
}

export const getEventRegistrations = async (req, res) => {
    try {
        const { eventId } = req.params;
        if (!eventId) {
            return res.status(400).json({ success: false, message: "Event ID is required" });
        }

        const session = await CreateSpeakerSession.findOne({ eventId });
        if (!session) {
            return res.status(404).json({ success: false, message: "Speaker session not found" });
        }

        // Admin or Secondary Admin can see registrations
        const adminEmailStr = session.admin_email ? session.admin_email.toString() : '';
        const isAuthorized = req.user.id.toString() === adminEmailStr || 
                             (session.secondaryAdmins && session.secondaryAdmins.some(id => id.toString() === req.user.id.toString()));

        if (!isAuthorized) {
            return res.status(403).json({ success: false, message: "Unauthorized to view these registrations" });
        }

        const registrations = await RegisterSpeakerSession.find({ eventId: session._id })
            .populate('userId', 'name email mobileNumber college year department') // Include user details
            .sort({ createdAt: -1 });

        return res.status(200).json({ 
            success: true, 
            message: "Registrations fetched successfully", 
            registrations 
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export const markAttendance = async (req, res) => {
    try {
        const { registrationId } = req.body;
        if (!registrationId) {
            return res.status(400).json({ success: false, message: "Registration ID is required" });
        }

        let registration = null;
        let session = null;

        if (registrationId.startsWith('admin_')) {
            const sessionId = registrationId.replace('admin_', '');
            session = await CreateSpeakerSession.findById(sessionId);
            if (!session) {
                return res.status(404).json({ success: false, message: "Organizer session not found" });
            }
            // For admin pass, we just verify they ARE an admin
            const adminIdStr = session.admin_email ? session.admin_email.toString() : '';
            const isSelfOrCollab = req.user.id.toString() === adminIdStr || 
                                 (session.secondaryAdmins && session.secondaryAdmins.some(id => id.toString() === req.user.id.toString()));
            
            if (!isSelfOrCollab) {
                 return res.status(403).json({ success: false, message: "Invalid Organizer Pass" });
            }

            return res.status(200).json({ 
                success: true, 
                message: "Organizer Pass Validated", 
                attendeeName: "Organizer / Admin" 
            });
        }

        registration = await RegisterSpeakerSession.findById(registrationId).populate('eventId');
        if (!registration) {
            return res.status(404).json({ success: false, message: "Registration not found" });
        }

        session = registration.eventId;
        if (!session) {
            return res.status(404).json({ success: false, message: "Associated session not found" });
        }

        // Admin or Secondary Admin can mark attendance
        const adminEmailStr = session.admin_email ? session.admin_email.toString() : '';
        const isAuthorized = req.user.id.toString() === adminEmailStr || 
                             (session.secondaryAdmins && session.secondaryAdmins.some(id => id.toString() === req.user.id.toString()));

        if (!isAuthorized) {
            return res.status(403).json({ success: false, message: "Unauthorized to mark attendance for this event" });
        }

        // Time Validation Check - ONLY for NON-ADMINS (Wait, admins are the ones SCANNING)
        // Actually, the request says "i want admin and secondary admin can mark present anytime"
        // This implies that the scanners (the admins) should be allowed to mark it.
        // The check was preventing the ADMIN from marking it early.
        
        // Bypassing time check if isAuthorized (which is already checked above)
        /* 
        const now = new Date();
        const parseTimeStr = (date, timeStr) => {
            const d = new Date(date);
            const [timePart, modifier] = timeStr.split(' ');
            let [hours, minutes] = timePart.split(':').map(Number);
            if (modifier === 'PM' && hours !== 12) hours += 12;
            if (modifier === 'AM' && hours === 12) hours = 0;
            d.setHours(hours, minutes, 0, 0);
            return d;
        };

        const eventStart = parseTimeStr(session.date, session.startTime);
        const eventEnd = parseTimeStr(session.date, session.endTime);

        if (now < eventStart) {
            return res.status(403).json({ 
                success: false, 
                message: `Attendance can only be marked once the session starts at ${session.startTime} on ${new Date(session.date).toLocaleDateString()}` 
            });
        }
        if (now > eventEnd) {
            return res.status(403).json({ 
                success: false, 
                message: "This session has ended. Attendance scanning is no longer allowed." 
            });
        }
        */

        if (registration.isPresent) {
            return res.status(200).json({ success: true, message: "Attendance already marked present" });
        }

        registration.isPresent = true;
        await registration.save();

        // Populate userId to get the name for the response
        await registration.populate('userId');
        const name = registration.userId?.name || "Attendee";

        return res.status(200).json({ 
            success: true, 
            message: `Attendance marked successfully for ${name}`,
            attendeeName: name
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export const getSpeakerSessionById = async (req, res) => {
    try {
        const { id } = req.params;
        const session = await CreateSpeakerSession.findById(id).populate('speakers').populate('secondaryAdmins', 'name username avatar email');
        if (!session) return res.status(404).json({ success: false, message: "Session not found" });
        return res.status(200).json({ success: true, session });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
}
