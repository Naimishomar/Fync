import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const connectDB = async () => {
    try {
        const connectionOptions = {
            maxPoolSize: 50,           // Maintain up to 50 socket connections
            minPoolSize: 10,           // Maintain at least 10 socket connections
            serverSelectionTimeoutMS: 5000, // Keep trying to connect for 5 seconds
            socketTimeoutMS: 45000,    // Close sockets after 45 seconds of inactivity
            family: 4                  // Use IPv4, skip trying IPv6
        };

        await mongoose.connect(process.env.MONGO_URI, connectionOptions);
        console.log("Connected to DB with Connection Pooling successfully✅");
    } catch (error) {
        console.log("DB connection error❌", error);
    }
}

export default connectDB;