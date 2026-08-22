import mongoose from "mongoose";

const affiliateProductSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    originalPrice: {
        type: Number
    },
    image: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true,
        enum: ['Education', 'Electronics', 'Fashion', 'Books', 'Lifestyle', 'Other']
    },
    affiliateLink: {
        type: String,
        required: true
    },
    commissionRate: {
        type: Number, // Percentage or fixed amount
        default: 0
    },
    brand: {
        type: String
    },
    isAvailable: {
        type: Boolean,
        default: true
    },
    rating: {
        type: Number,
        default: 0
    },
    reviewsCount: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

// Covers the list query's filter AND its sort; without it the sort was done
// in memory over every matching document.
affiliateProductSchema.index({ isAvailable: 1, category: 1, createdAt: -1 });

const AffiliateProduct = mongoose.model('AffiliateProduct', affiliateProductSchema);
export default AffiliateProduct;
