import mongoose from "mongoose";

const monthlyStatsSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    month: {
        type: String, // e.g., 'YYYY-MM'
        required: true,
        index: true
    },
    totalPaid: {
        type: Number,
        default: 0
    },
    totalReceived: {
        type: Number,
        default: 0
    },
    totalOwed: {
        type: Number, // positive means they owe others, negative means others owe them
        default: 0
    }
}, { timestamps: true });

// One record per user per month
monthlyStatsSchema.index({ user: 1, month: 1 }, { unique: true });

const MonthlyStats = mongoose.model("MonthlyStats", monthlyStatsSchema);
export default MonthlyStats;
