import mongoose from "mongoose";

const paymentTransactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    amount: {
        type: Number,
        required: true
    },
    merchantUpiId: {
        type: String,
        required: true
    },
    merchantName: {
        type: String,
        default: ""
    },
    status: {
        type: String,
        enum: ['pending', 'success', 'failed'],
        default: 'success'
    },
    referenceId: {
        type: String
    }
}, { timestamps: true });

const PaymentTransaction = mongoose.model("PaymentTransaction", paymentTransactionSchema);
export default PaymentTransaction;
