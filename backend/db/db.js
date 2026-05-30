import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({quiet: true});

const connectDB = async () => {
    try {
        const connectionOptions = {
            maxPoolSize: 100,           
            minPoolSize: 20,           
            serverSelectionTimeoutMS: 30000, // Increased to 30s
            socketTimeoutMS: 45000,    
            family: 4,
            connectTimeoutMS: 30000,
            heartbeatFrequencyMS: 10000,
        };

        mongoose.connection.on('connected', () => {
            console.log('📡 MongoDB Connected');
        });

        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB Connection Error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️ MongoDB Disconnected. Attempting to reconnect...');
        });

        await mongoose.connect(process.env.MONGO_URI, connectionOptions);
        console.log("Connected to DB with Connection Pooling successfully✅");
    } catch (error) {
        console.log("DB connection error❌", error);
        throw error; 
    }
};

export default connectDB;