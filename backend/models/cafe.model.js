import mongoose from "mongoose";

const cafeSchema = new mongoose.Schema({
    cafe_name:{
        type:String,
        required:true
    },
    cafe_image:{
        type:[String],
        required:true
    },
    cafe_description:{
        type:String,
        required:true
    },
    cafe_owner:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        require: true
    },
    college:{
        type: String,
        required:true
    },
    cafe_account_number:{
        type:Number,
        required:true
    },
    ifsc_code:{
        type:String,
        required:true
    }
},{timestamps:true});

const Cafe = mongoose.model('Cafe', cafeSchema);
export default Cafe;