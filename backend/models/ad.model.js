import mongoose from 'mongoose';

const adSchema = new mongoose.Schema({
    imageUrl: {
        type: String,
        required: true,
    },
    linkUrl: {
        type: String,
        default: null,
    },
    title: {
        type: String,
        default: null,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
}, { timestamps: true });

const Ad = mongoose.model('Ad', adSchema);
export default Ad;
