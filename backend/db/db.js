import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const connectDB = async () =>{
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB successfully✅");
    } catch (error) {
        console.log("DB connection error❌", error);
    }
}

export default connectDB;