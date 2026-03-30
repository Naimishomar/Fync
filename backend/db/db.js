import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({quiet: true});

const connectDB = async () => {
    try {
        const connectionOptions = {
            maxPoolSize: 50,           
            minPoolSize: 10,           
            serverSelectionTimeoutMS: 10000, 
            socketTimeoutMS: 45000,    
            family: 4                  
        };
        await mongoose.connect(process.env.MONGO_URI, connectionOptions);
        console.log("Connected to DB with Connection Pooling successfully✅");
    } catch (error) {
        console.log("DB connection error❌", error);
    }
}

export default connectDB;