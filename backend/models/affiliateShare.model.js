import mongoose from "mongoose";

/**
 * A student's referral link to one product.
 *
 * Phase 1 records attribution only — who shared what, and how many taps it
 * produced. No money is computed or owed here. That deliberately comes later,
 * once there is a real affiliate-network callback to confirm sales: paying on
 * taps would be paying for fraud.
 */
const affiliateShareSchema = new mongoose.Schema({
    // Short, URL-safe, and the only thing that travels in the link.
    code: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    sharer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AffiliateProduct',
        required: true
    },
    clicks: {
        type: Number,
        default: 0
    },
    // Taps by the sharer on their own link. Counted separately rather than
    // dropped, so the sharer still sees their own test taps but phase 2 has an
    // honest number to pay against.
    selfClicks: {
        type: Number,
        default: 0
    },
    lastClickedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

// One link per person per product, and the "my shares" list is newest-first.
affiliateShareSchema.index({ sharer: 1, product: 1 }, { unique: true });
affiliateShareSchema.index({ sharer: 1, createdAt: -1 });

const AffiliateShare = mongoose.model('AffiliateShare', affiliateShareSchema);
export default AffiliateShare;
