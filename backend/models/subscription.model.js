import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    razorpayOrderId: {
        type: String,
        required: true
    },
    razorpayPaymentId: {
        type: String
    },
    amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'active', 'expired', 'failed'],
        default: 'pending'
    },
    startDate: {
        type: Date
    },
    endDate: {
        type: Date
    }
}, { timestamps: true });

// A 'pending' row is a checkout that was never paid; drop it after 7 days.
// active/expired rows are payment records and are kept.
subscriptionSchema.index(
    { createdAt: 1 },
    { expireAfterSeconds: 7 * 24 * 60 * 60, partialFilterExpression: { status: "pending" } }
);

const Subscription = mongoose.model("Subscription", subscriptionSchema);
export default Subscription;
