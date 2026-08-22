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

// Covers the list query's filter AND its sort; without it the sort was done
// in memory over every matching document.
adSchema.index({ isActive: 1, order: 1, createdAt: -1 });

const Ad = mongoose.model('Ad', adSchema);
export default Ad;
