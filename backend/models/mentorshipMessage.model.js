import mongoose from "mongoose";

const mentorshipMessageSchema = new mongoose.Schema({
    college: {
        type: String,
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
    mentions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MentorshipMessage",
        default: null
    }
}, { timestamps: true });

const MentorshipMessage = mongoose.model('MentorshipMessage', mentorshipMessageSchema);
export default MentorshipMessage;
