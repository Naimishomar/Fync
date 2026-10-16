import mongoose from "mongoose";

const reportSchema = new mongoose.Schema({
    reporter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    // Exactly one of post / short is set.
    post: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post",
        required: function () { return !this.short; }
    },
    short: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Shorts"
    },
    reason: {
        type: String,
        required: true,
        default: "Inappropriate content"
    },
    status: {
        type: String,
        enum: ["pending", "resolved", "dismissed"],
        default: "pending"
    }
}, { timestamps: true });

const Report = mongoose.model("Report", reportSchema);
export default Report;
