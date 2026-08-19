import mongoose from "mongoose";

const BootcampSchema = new mongoose.Schema({
    eventId: { 
        type: String, 
        unique: true, 
        required: true 
    },
    admin_email: { 
        type: String, 
        required: true 
    },
    eventName: { 
        type: String, 
        required: true 
    },
    description: { 
        type: String, 
        required: true 
    },
    college: { 
        type: String, 
        required: true 
    },
    venue: { 
        type: String, 
        required: true 
    },
    startDate: { 
        type: Date, 
        required: true 
    },
    endDate: { 
        type: Date, 
        required: true 
    },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    userLimit: { type: Number, default: 1000000 },
    fee: { type: Number, default: 0 },
    admin_upi_id: { type: String },
    isCollegeSpecific: { type: Boolean, default: false },
    logo: { type: String },
    banner: { type: String },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    // Reservation counter for the capacity check. Registration documents remain
    // the record of who is actually in; this exists only so a seat can be
    // claimed atomically instead of counting-then-inserting, which overbooked
    // whenever two people registered at the same moment.
    seatsTaken: { type: Number, default: 0 },
    instructors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Speaker' }],
    curriculum: [{ type: String }],
    secondaryAdmins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isCommunityActive: { type: Boolean, default: true },
    contactDetails: [{
        name: String,
        mobile: String,
        email: String
    }],
}, { timestamps: true });

// Mirrors the getAllBootcamps filter: open bootcamps by start date, plus the
// two organiser lookups.
BootcampSchema.index({ status: 1, startDate: 1 });
BootcampSchema.index({ admin_email: 1 });
BootcampSchema.index({ secondaryAdmins: 1 });

export default mongoose.model("Bootcamp", BootcampSchema);
