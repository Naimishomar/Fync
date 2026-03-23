import mongoose from "mongoose";

const RegisterBootcampSchema = new mongoose.Schema({
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bootcamp', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isPaid: { type: Boolean, default: false },
    qrCode: { type: String },
    attendance: [{
        date: { type: String, required: true }, // Store as YYYY-MM-DD
        isPresent: { type: Boolean, default: false }
    }]
}, { timestamps: true });

RegisterBootcampSchema.index({ eventId: 1, userId: 1 }, { unique: true });

export default mongoose.model("RegisterBootcamp", RegisterBootcampSchema);
