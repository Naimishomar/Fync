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
    // Who shared the link this sale came through, if anyone. Recorded from the
    // first tap so attribution exists before any payout logic does.
    sharer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    shareCode: {
        type: String,
        default: null
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

// Phase 2 will pay against this; the index exists now so the query is ready.
affiliateSaleSchema.index({ sharer: 1, status: 1, createdAt: -1 });

const AffiliateSale = mongoose.model('AffiliateSale', affiliateSaleSchema);
export default AffiliateSale;
