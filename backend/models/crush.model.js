import mongoose from "mongoose";

const crushSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    crushUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    isMutual: {
        type: Boolean,
        default: false
    },
    lastNotifiedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

// Ensure a user can only have a specific crush once
crushSchema.index({ userId: 1, crushUserId: 1 }, { unique: true });

const Crush = mongoose.model('Crush', crushSchema);
export default Crush;
