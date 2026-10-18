import mongoose from "mongoose";

const coupleNoteSchema = new mongoose.Schema({
    couple: { type: mongoose.Schema.Types.ObjectId, ref: "Couple", required: true },
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, maxlength: 280 },
    readAt: { type: Date, default: null },
}, { timestamps: { createdAt: true, updatedAt: false } });

coupleNoteSchema.index({ couple: 1, createdAt: -1 });

export default mongoose.model("CoupleNote", coupleNoteSchema);
