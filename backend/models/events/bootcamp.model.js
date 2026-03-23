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

export default mongoose.model("Bootcamp", BootcampSchema);
