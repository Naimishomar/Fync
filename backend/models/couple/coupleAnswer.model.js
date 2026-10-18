import mongoose from "mongoose";

const coupleAnswerSchema = new mongoose.Schema({
    couple: { type: mongoose.Schema.Types.ObjectId, ref: "Couple", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    day: { type: String, required: true }, // IST "YYYY-MM-DD"
    text: { type: String, required: true, maxlength: 300 },
}, { timestamps: { createdAt: true, updatedAt: false } });

coupleAnswerSchema.index({ couple: 1, day: -1, user: 1 }, { unique: true });

export default mongoose.model("CoupleAnswer", coupleAnswerSchema);
