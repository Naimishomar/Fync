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
    }
},{timestamps:true});

const Cafe = mongoose.model('Cafe', cafeSchema);
export default Cafe;