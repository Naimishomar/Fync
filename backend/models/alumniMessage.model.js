import mongoose from "mongoose";

const alumniMessageSchema = new mongoose.Schema({
    college: {
        type: String,
        required: true,
        index: true
    },
    graduationYear: {
        type: Number,
        required: true,
        index: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    message: {
        type: String,
    },
    messageType: {
        type: String,
        enum: ['text', 'image', 'file'],
        default: 'text'
    },
    fileUrl: {
        type: String,
    },
    fileName: {
        type: String,
    },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
}, { timestamps: true });

const AlumniMessage = mongoose.model('AlumniMessage', alumniMessageSchema);
export default AlumniMessage;
