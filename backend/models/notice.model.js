import mongoose from "mongoose";
import { create } from "qrcode";

const noticeSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    link: {
        type: String,
    },
    image: {
        type: [String],
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    college: {
        type: String,
        required: true
    },
    isGlobal: {
        type: Boolean,
        default: false,
    },
    comments: {
        type: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Comment",
            },
        ],
        default: [],
    },
    likes: {
        type: Number,
        default: 0
    },
    liked_by: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    createdAt: {
        type: Date,
        default: Date.now,
        index: { expires: '7d' }
    }
});


// Notice board: per-college, newest first.
noticeSchema.index({ college: 1, createdAt: -1 });

const Notice = mongoose.model('Notice', noticeSchema);
export default Notice;