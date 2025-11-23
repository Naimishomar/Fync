import mongoose from "mongoose";

const olxSchema = new mongoose.Schema({
    product_name:{
        type:String,
        required:true
    },
    product_description:{
        type:String,
        required:true
    },
    product_image:{
        type:[String],
        required:true
    },
    product_type:{
        type:String,
        required:true,
        enum:['electronics','clothes','books','furniture','appliances','toys','other']
    },
    price:{
        type:Number,
        required:true
    },
    is_selled:{
        type:Boolean,
        default:false
    },
    seller:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    buyer:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
    },
    college:{
        type: String,
        required:true
    }
},{timestamps:true});

const OLX = mongoose.model('OLX', olxSchema);
export default OLX;