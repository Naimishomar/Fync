import mongoose from "mongoose";

const splitMemberSchema = new mongoose.Schema({
    split: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Split",
        required: true,
        index: true
    },
    debtor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'paid'],
        default: 'pending',
        index: true
    },
    paymentReference: {
        type: String
    },
    paidAt: {
        type: Date
    }
}, { timestamps: true });

// Prevent duplicate debts for the same split and debtor
splitMemberSchema.index({ split: 1, debtor: 1 }, { unique: true });

const SplitMember = mongoose.model("SplitMember", splitMemberSchema);
export default SplitMember;
