import mongoose from "mongoose";

const splitSchema = new mongoose.Schema({
    payer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    paymentTransaction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PaymentTransaction"
    },
    amount: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SplitGroup",
        index: true
    },
    status: {
        type: String,
        enum: ['pending', 'settled'],
        default: 'pending'
    }
}, { timestamps: true });

const Split = mongoose.model("Split", splitSchema);
export default Split;
