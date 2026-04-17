import mongoose from "mongoose";

const opportunitySchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    company: {
        type: String,
        required: true,
        trim: true
    },
    companyLogo: {
        type: String,
        default: ""
    },
    location: {
        type: String,
        enum: ["Remote", "Onsite", "Hybrid"],
        default: "Remote"
    },
    type: {
        type: String,
        enum: ["internship", "job"],
        required: true
    },
    opportunityType: { 
        type: String,
        enum: ["Full-Time", "Part-Time"],
        default: "Full-Time"
    },
    duration: {
        type: String,
        default: ""
    },
    isPaid: {
        type: Boolean,
        default: false
    },
    stipend: { 
        type: String,
        default: "Unpaid"
    },
    description: {
        type: String,
        required: true
    },
    applicationLink: {
        type: String,
        default: ""
    },
    requireResume: {
        type: Boolean,
        default: true
    },
    postedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Opportunity = mongoose.model("Opportunity", opportunitySchema);
export default Opportunity;
