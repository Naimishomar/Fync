import mongoose from "mongoose";

const dishesSchema = new mongoose.Schema({
    dish_cafe:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Cafe",
        required:true
    },
    dish_name:{
        type:String,
        required:true
    },
    dish_image:{
        type:[String],
        required:true
    },
    dish_price:{
        type:Number,
        required:true
    },
    dish_type:{
        type:String,
        required:true,
        enum:['Pizza','Burger','Sandwich','Salad','Soup','Dessert','Other']
    },
    dish_category:{
        type:String,
        required:true,
        enum:['veg','non-veg']
    },
    rating:{
        type:Number,
    },
    ingredients:{
        type:[String],
        required:true
    }
},{timestamps:true});

const Dishes = mongoose.model('Dishes', dishesSchema);
export default Dishes;