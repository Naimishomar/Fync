import mongoose from "mongoose";

const internshipSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    company: {
        type: String,
        required: true,
        trim: true
    },
    companyLogo: {
        type: String,
        default: null
    },
    role: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['internship', 'full-time', 'part-time', 'freelance', 'contract', 'open-source'],
        default: 'internship'
    },
    description: {
        type: String,
        trim: true
    },
    techStack: {
        type: [String],
        default: []
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        default: null
    },
    isCurrentlyWorking: {
        type: Boolean,
        default: false
    },
    location: {
        type: String,
        default: null
    },
    workMode: {
        type: String,
        enum: ['remote', 'onsite', 'hybrid'],
        default: 'remote'
    },
    // Self-reported — no admin verification needed
    isVerified: {
        type: Boolean,
        default: false
    },
    isPublic: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

internshipSchema.index({ user: 1, startDate: -1 });

const Internship = mongoose.model("Internship", internshipSchema);
export default Internship;
