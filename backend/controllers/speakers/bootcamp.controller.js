import Bootcamp from "../../models/events/bootcamp.model.js";
import RegisterBootcamp from "../../models/events/registerBootcamp.model.js";
import Speaker from "../../models/events/speakers.model.js";
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

// --- HELPER ---
const formatDate = (date) => new Date(date).toISOString().split('T')[0];

export const createBootcamp = async(req,res)=>{
    try {
        const { admin_email, eventName, description, college, venue, startDate, endDate, startTime, endTime, userLimit, agenda, fee, admin_upi_id, isCollegeSpecific } = req.body;
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

        if(!admin_email || !eventName || !description || !college || !venue || !startDate || !endDate || !startTime || !endTime || userLimit === undefined || fee === undefined){
            if (logo) await deleteFromCloudinary(logo);
            if (banner) await deleteFromCloudinary(banner);
            return res.status(400).json({success: false, message: "Required all fields missing"});
        }

        const nanoidNumbers = customAlphabet('0123456789', 6);
        const eventId = `BC-${nanoidNumbers()}`;

        const bootcamp = await Bootcamp.create({
            eventId, admin_email, eventName, description, college, venue,
            startDate, endDate, startTime, endTime,
            userLimit, fee, admin_upi_id, 
            isCollegeSpecific: isCollegeSpecific === 'true' || isCollegeSpecific === true,
            logo, banner, status: 'open',
            contactDetails: contactDetails || []
        })

        // Auto-register primary admin
        const start = new Date(bootcamp.startDate);
        const end = new Date(bootcamp.endDate);
        const attendance = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            attendance.push({ date: formatDate(d), isPresent: true }); // Admin always present
        }

        let registration = await RegisterBootcamp.create({
            eventId: bootcamp._id,
            userId: req.user.id,
            isPaid: true,
            attendance
        });
        
        const qrCode = await QRCode.toDataURL(JSON.stringify({
            registrationId: registration._id,
            type: 'bootcamp',
            eventId: bootcamp.eventId,
            role: 'administrator'
        }));
        registration.qrCode = qrCode;
        await registration.save();

        return res.status(200).json({ success: true, message: "Bootcamp created successfully", bootcamp });
    } catch (error) {
        if (req.files?.logo?.[0]?.path) await deleteFromCloudinary(req.files.logo[0].path);
        if (req.files?.banner?.[0]?.path) await deleteFromCloudinary(req.files.banner[0].path);
        return res.status(500).json({ success: false, message: error.message || "Internal server error" })
    }
}

export const getAllBootcamps = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const bootcamps = await Bootcamp.find({ 
            $or: [
                { 
                    status: 'open',
                    $or: [
                        { isCollegeSpecific: false },
                        { isCollegeSpecific: true, college: req.user.college }
                    ]
                },
                { admin_email: req.user.email },
                { secondaryAdmins: req.user.id }
            ]
        })
            .sort({ startDate: 1 })
            .skip(skip)
            .limit(limit)
            .populate('instructors')
            .populate('secondaryAdmins', 'name username avatar email');

        const bootcampsWithCount = await Promise.all(bootcamps.map(async (b) => {
            const count = await RegisterBootcamp.countDocuments({ eventId: b._id });
            const obj = b.toObject();
            obj.registrationsCount = count;
            return obj;
        }));

        return res.status(200).json({ success: true, sessions: bootcampsWithCount, hasMore: bootcamps.length === limit });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message })
    }
}

export const registerBootcamp = async(req,res)=>{
    try {
        const { eventId } = req.body;
        const session = await Bootcamp.findOne({ eventId });
        if (!session) return res.status(404).json({ success: false, message: "Bootcamp not found" });

        const isAdmin = session.admin_email.toLowerCase() === req.user.email.toLowerCase() || 
                        (session.secondaryAdmins || []).some(a => a.toString() === req.user.id.toString());
        if (isAdmin) {
             return res.status(400).json({ success: false, message: "Organizers have full access and do not need to register." });
        }

        const count = await RegisterBootcamp.countDocuments({ eventId: session._id });
        if (session.userLimit && count >= session.userLimit) {
            return res.status(400).json({ success: false, message: "Bootcamp is at full capacity" });
        }

        if (session.isCollegeSpecific && session.college !== req.user.college) {
            return res.status(403).json({ success: false, message: `This event is restricted to ${session.college} students` });
        }

        const existing = await RegisterBootcamp.findOne({ eventId: session._id, userId: req.user.id });
        if (existing) {
            if (existing.isPaid) {
                return res.status(400).json({ success: false, message: "Already registered" });
            }
            // Payment was never completed. Delete and start fresh so the user can re-register.
            await RegisterBootcamp.deleteOne({ _id: existing._id });
        }

        // Build base attendance array
        const start = new Date(session.startDate);
        const end = new Date(session.endDate);
        const attendance = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            attendance.push({ date: formatDate(d), isPresent: false });
        }

        let registration = await RegisterBootcamp.create({
            eventId: session._id,
            userId: req.user.id,
            isPaid: session.fee === 0,
            attendance
        })

        const qrCode = await QRCode.toDataURL(JSON.stringify({
            registrationId: registration._id,
            type: 'bootcamp',
            eventId: session.eventId,
            email: req.user.email
        }));
        
        registration.qrCode = qrCode;
        await registration.save();

        let order = null;
        if (session.fee > 0) {
            order = await razorpay.orders.create({
                amount: session.fee * 100,
                currency: "INR",
                receipt: `bc_reg_${registration._id}`,
                notes: { type: 'bootcamp', registrationId: registration._id, userId: req.user.id }
            });
        }

        return res.status(200).json({ success: true, registration, order });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message })
    }
}

export const markBootcampAttendance = async (req, res) => {
    try {
        const { registrationId, date } = req.body; // date format YYYY-MM-DD
        const realToday = formatDate(new Date());
        const today = date || realToday;

        if (today > realToday) {
            return res.status(400).json({ success: false, message: "Attendance cannot be marked for future dates" });
        }

        let registration = null;
        let session = null;
        
        if (registrationId.startsWith('admin_')) {
            const sessionId = registrationId.replace('admin_', '');
            session = await Bootcamp.findById(sessionId);
            if (!session) {
                return res.status(404).json({ success: false, message: "Organizer session not found" });
            }
            const isAuthorized = req.user.email.toLowerCase() === session.admin_email.toLowerCase() || 
                               (session.secondaryAdmins || []).some(a => a.toString() === req.user.id.toString());

            if (!isAuthorized) {
                return res.status(403).json({ success: false, message: "Invalid Organizer Pass" });
            }

            return res.status(200).json({ success: true, message: "Organizer Pass Validated", attendeeName: "Organizer / Admin" });
        }

        registration = await RegisterBootcamp.findById(registrationId).populate('eventId');
        if (!registration) return res.status(404).json({ success: false, message: "Registration not found" });

        session = registration.eventId;
        const isAuthorized = req.user.email.toLowerCase() === session.admin_email.toLowerCase() || 
                             (session.secondaryAdmins || []).some(a => a.toString() === req.user.id.toString());

        if (!isAuthorized) {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        // --- Daily Time Window Validation ---
        const parseTimeStr = (dateStr, timeStr) => {
            const d = new Date(dateStr);
            const [timePart, modifier] = timeStr.split(' ');
            let [hours, minutes] = timePart.split(':').map(Number);
            if (modifier === 'PM' && hours !== 12) hours += 12;
            if (modifier === 'AM' && hours === 12) hours = 0;
            d.setHours(hours, minutes, 0, 0);
            return d;
        };

        const now = new Date();
        const startWindow = parseTimeStr(today, session.startTime);
        const endWindow = parseTimeStr(today, session.endTime);

        if (now < startWindow) {
            return res.status(403).json({ success: false, message: `Attendance window for ${today} opens at ${session.startTime}` });
        }
        if (now > endWindow) {
             return res.status(403).json({ success: false, message: `Attendance cannot be marked after ${session.endTime} for ${today}` });
        }

        const dayRecord = registration.attendance.find(a => a.date === today);
        if (!dayRecord) {
            return res.status(400).json({ success: false, message: `Bootcamp is not scheduled for ${today}` });
        }

        if (dayRecord.isPresent) {
            return res.status(200).json({ success: true, message: "Attendance already marked" });
        }

        dayRecord.isPresent = true;
        await registration.save();

        return res.status(200).json({ success: true, message: `Presence recorded for ${today}` });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

export const getBootcampRegistrations = async (req, res) => {
    try {
        const { eventId } = req.params;
        const session = await Bootcamp.findOne({ eventId });
        if (!session) return res.status(404).json({ success: false, message: "Not found" });

        const isAuthorized = req.user.email.toLowerCase() === session.admin_email.toLowerCase() || 
                             (session.secondaryAdmins || []).some(a => a.toString() === req.user.id.toString());

        if (!isAuthorized) {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        const registrations = await RegisterBootcamp.find({ eventId: session._id, isPaid: true })
            .populate('userId', 'name email mobileNumber college year department')
            .sort({ createdAt: -1 });

        return res.status(200).json({ success: true, registrations });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

export const getMyBootcampRegistrations = async (req, res) => {
    try {
        // 1. Genuine registrations
        const registrations = await RegisterBootcamp.find({ userId: req.user.id, isPaid: true })
            .populate('eventId')
            .sort({ createdAt: -1 });

        // 2. Admin sessions
        const adminSessions = await Bootcamp.find({
            $or: [
                { admin_email: req.user.email },
                { secondaryAdmins: req.user.id }
            ]
        }).populate('secondaryAdmins', 'name username avatar email');

        // Automatically create permanent RegisterBootcamp records for admins who are missing them
        const adminAsRegistrations = await Promise.all(adminSessions.map(async s => {
            // Because adminSessions might already have a corresponding entry in 'registrations', 
            // we first check if one exists to avoid redundant checks, 
            // but the filter at line 340 will handle duplicates anyway.
            const existing = await RegisterBootcamp.findOne({ eventId: s._id, userId: req.user.id });
            if (existing) return existing.populate('eventId');

            // Create new registration if missing
            const start = new Date(s.startDate);
            const end = new Date(s.endDate);
            const attendance = [];
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                attendance.push({ date: d.toISOString().split('T')[0], isPresent: true }); // Admin always present
            }

            let registration = await RegisterBootcamp.create({
                eventId: s._id,
                userId: req.user.id,
                isPaid: true,
                attendance,
                qrCode: "pending"
            });

            const qrCode = await QRCode.toDataURL(JSON.stringify({
                registrationId: registration._id,
                type: 'bootcamp',
                eventId: s.eventId,
                email: req.user.email,
                role: 'administrator'
            }));
            registration.qrCode = qrCode;
            await registration.save();
            return registration.populate('eventId');
        }));

        // Merge and avoid duplicates by checking eventId
        let combined = [...registrations];
        for (const adminReg of adminAsRegistrations) {
            if (!combined.some(r => r.eventId?._id?.toString() === adminReg.eventId?._id?.toString())) {
                combined.push(adminReg);
            }
        }

        // Filter out registrations for deleted events
        combined = combined.filter(r => r.eventId !== null);

        return res.status(200).json({ success: true, registrations: combined });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}
 
export const cancelBootcampRegistration = async (req, res) => {
    try {
        const { id } = req.params;
        const reg = await RegisterBootcamp.findById(id);
        if (!reg) return res.status(404).json({ success: false, message: "Not found" });
        if (reg.userId.toString() !== req.user.id.toString()) {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }
        if (reg.isPaid) {
            return res.status(400).json({ success: false, message: "Paid registrations cannot be cancelled this way" });
        }
        await RegisterBootcamp.deleteOne({ _id: id });
        return res.status(200).json({ success: true, message: "Registration cancelled" });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
}

export const getBootcampById = async (req, res) => {
    try {
        const { id } = req.params;
        const session = await Bootcamp.findById(id).populate('instructors').populate('secondaryAdmins', 'name username avatar email');
        if (!session) return res.status(404).json({ success: false, message: "Bootcamp not found" });
        return res.status(200).json({ success: true, session });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
}

export const updateBootcamp = async (req, res) => {
    try {
        const { eventId, eventName, description, college, venue, startDate, endDate, startTime, endTime, userLimit, agenda, fee, admin_upi_id, status, isCollegeSpecific, isCommunityActive } = req.body;
        let contactDetails = req.body.contactDetails;
        if (typeof contactDetails === 'string') {
            try {
                contactDetails = JSON.parse(contactDetails);
            } catch (e) {
                contactDetails = undefined;
            }
        }

        if (!eventId) {
            return res.status(400).json({ success: false, message: "Event ID is required" });
        }

        const bootcamp = await Bootcamp.findOne({ eventId });
        if (!bootcamp) {
            return res.status(404).json({ success: false, message: "Bootcamp not found" });
        }

        if (req.user.email.toLowerCase() !== bootcamp.admin_email.toLowerCase()) {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        const logo = req.files?.logo?.[0]?.path;
        const banner = req.files?.banner?.[0]?.path;

        if (logo && bootcamp.logo) await deleteFromCloudinary(bootcamp.logo);
        if (banner && bootcamp.banner) await deleteFromCloudinary(bootcamp.banner);

        const updatedBootcamp = await Bootcamp.findOneAndUpdate(
            { eventId },
            {
                $set: {
                    ...(eventName !== undefined && { eventName }),
                    ...(description !== undefined && { description }),
                    ...(college !== undefined && { college }),
                    ...(venue !== undefined && { venue }),
                    ...(startDate !== undefined && { startDate }),
                    ...(endDate !== undefined && { endDate }),
                    ...(startTime !== undefined && { startTime }),
                    ...(endTime !== undefined && { endTime }),
                    ...(userLimit !== undefined && { userLimit }),
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
        ).populate('secondaryAdmins', 'name username avatar email');

        return res.status(200).json({ success: true, message: "Bootcamp updated successfully", bootcamp: updatedBootcamp });
    } catch (error) {
        if (req.files?.logo?.[0]?.path) await deleteFromCloudinary(req.files.logo[0].path);
        if (req.files?.banner?.[0]?.path) await deleteFromCloudinary(req.files.banner[0].path);
        return res.status(500).json({ success: false, message: error.message });
    }
}

export const deleteBootcamp = async (req, res) => {
    try {
        const { eventId } = req.body;
        if (!eventId) {
            return res.status(400).json({ success: false, message: "Event ID is required" });
        }

        const bootcamp = await Bootcamp.findOne({ eventId });
        if (!bootcamp) {
            return res.status(404).json({ success: false, message: "Bootcamp not found" });
        }

        if (req.user.email.toLowerCase() !== bootcamp.admin_email.toLowerCase()) {
            return res.status(403).json({ success: false, message: "Unauthorized to delete this Bootcamp" });
        }

        // Cleanup related data
        if (bootcamp.logo) await deleteFromCloudinary(bootcamp.logo);
        if (bootcamp.banner) await deleteFromCloudinary(bootcamp.banner);

        // Delete all registrations
        await RegisterBootcamp.deleteMany({ eventId: bootcamp._id });

        // Delete the bootcamp
        await Bootcamp.deleteOne({ eventId });

        return res.status(200).json({ success: true, message: "Bootcamp and related data deleted successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}
