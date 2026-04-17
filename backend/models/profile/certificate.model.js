import mongoose from "mongoose";

const certificateSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    issuer: {
        type: String,
        required: true,
        trim: true
    },
    issueDate: {
        type: Date,
        default: null
    },
    expiryDate: {
        type: Date,
        default: null
    },
    credentialUrl: {
        type: String,
        default: null
    },
    imageUrl: {
        type: String,
        default: null
    },
    credentialId: {
        type: String,
        default: null
    },
    category: {
        type: String,
        enum: ['coding', 'design', 'cloud', 'ai-ml', 'cybersecurity', 'management', 'data-science', 'other'],
        default: 'other'
    },
    source: {
        type: String,
        enum: ['manual', 'linkedin', 'coursera', 'udemy', 'google', 'aws', 'microsoft', 'nptel', 'other'],
        default: 'manual'
    },
    isPublic: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

certificateSchema.index({ user: 1, issueDate: -1 });

const Certificate = mongoose.model("Certificate", certificateSchema);
export default Certificate;
