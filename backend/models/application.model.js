import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema({
    opportunity: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Opportunity",
        required: true
    },
    candidate: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    recruiter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    status: {
        type: String,
        enum: ["applied", "reviewing", "shortlisted", "rejected", "accepted"],
        default: "applied"
    },
    resume: {
        type: String, // URL to the resume (PDF)
        default: ""
    },
    coverLetter: {
        type: String,
        default: ""
    },
    portfolioUrl: {
        type: String,
        default: ""
    },
    appliedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Prevent duplicate applications for the same opportunity
applicationSchema.index({ opportunity: 1, candidate: 1 }, { unique: true });

const Application = mongoose.model("Application", applicationSchema);
export default Application;
