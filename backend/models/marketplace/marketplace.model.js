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

const MarketPlace = mongoose.model("MarketPlace", marketplaceSchema);
export default MarketPlace;