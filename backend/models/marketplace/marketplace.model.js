import mongoose from "mongoose";

const marketplaceSchema = new mongoose.Schema({
    product_name:{
        type: String,
        required: true,
        minLength: [3, "Product name must be at least 3 characters long"],
        maxLength: [50, "Product name must be at most 50 characters long"]
    },
    product_description:{
        type: String, 
        required: true,
        minLength: [3, "Product description must be at least 3 characters long"],
        maxLength: [500, "Product description must be at most 500 characters long"]
    },
    coins_required:{
        type: Number,
        required: true,
    },
    product_image:{
        type: String,
        required: true
    },
    is_available:{
        type: Boolean,
        default: true
    }
},{timestamps: true});

// The listing for this collection is cached and shared by every user, so a
// create/update/delete must bust it. Hooking the model covers every write path,
// including ones added later.
const bustMarketplace = async () => {
    try {
        const { clearCacheTags } = await import('../../middlewares/cache.middleware.js');
        await clearCacheTags(['marketplace']);
    } catch (err) {
        console.error('Cache invalidation error:', err.message);
    }
};
marketplaceSchema.post('save', bustMarketplace);
marketplaceSchema.post(/^findOneAnd/, bustMarketplace);
marketplaceSchema.post(['updateOne', 'updateMany', 'deleteOne', 'deleteMany'], bustMarketplace);

const MarketPlace = mongoose.model("MarketPlace", marketplaceSchema);
export default MarketPlace;