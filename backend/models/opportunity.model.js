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
        default: "Remote"
    },
    type: {
        type: String,
        enum: ["internship", "job"],
        required: true
    },
    opportunityType: { // e.g. "Full-Time", "Part-Time", "Contract"
        type: String,
        default: "Full-Time"
    },
    duration: {
        type: String,
        default: ""
    },
    stipend: { // or salary
        type: String,
        default: "Unpaid"
    },
    description: {
        type: String,
        required: true
    },
    applicationLink: {
        type: String,
        required: true
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
