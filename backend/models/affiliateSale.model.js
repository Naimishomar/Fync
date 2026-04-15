import mongoose from "mongoose";

const affiliateSaleSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AffiliateProduct',
        required: true
    },
    orderValue: {
        type: Number,
        required: true
    },
    commission: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['Pending', 'Completed', 'Cancelled', 'Refunded'],
        default: 'Pending'
    },
    affiliateSource: {
        type: String, // e.g. "Amazon", "Flipkart"
        required: true
    },
    transactionId: {
        type: String, // From the affiliate partner
        unique: true
    },
    clickedAt: {
        type: Date,
        default: Date.now
    },
    completedAt: {
        type: Date
    }
}, { timestamps: true });

const AffiliateSale = mongoose.model('AffiliateSale', affiliateSaleSchema);
export default AffiliateSale;
