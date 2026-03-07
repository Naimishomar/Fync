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
    createdAt: {
        type: Date,
        default: Date.now,
        index: { expires: '7d' }
    }
});

const Notice = mongoose.model('Notice', noticeSchema);
export default Notice;