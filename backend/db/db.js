import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({quiet: true});

const connectDB = async () => {
    try {
        // Pool size is bounded by CPU, not by user count. A pool of 100 cannot
        // help a 2-vCPU box -- it can only run a couple of queries at a time --
        // and every idle connection still costs a socket plus buffers on both
        // ends. minPoolSize 20 held twenty of them open permanently even at 3am.
        //
        // A small pool with a queue is the right shape here: requests wait a few
        // milliseconds instead of the database thrashing. Override via env when
        // moving to a larger instance.
        const poolSize = Number(process.env.MONGO_POOL_SIZE || 12);

        const connectionOptions = {
            maxPoolSize: poolSize,
            minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE || 2),
            // Fail a request in a few seconds rather than holding it (and its
            // memory) for thirty while the primary is unreachable.
            serverSelectionTimeoutMS: 8000,
            socketTimeoutMS: 45000,
            family: 4,
            connectTimeoutMS: 10000,
            heartbeatFrequencyMS: 10000,
            // Recycle idle connections instead of pinning them for the process
            // lifetime; on a burstable instance the traffic is spiky.
            maxIdleTimeMS: 60000,
            // Cap how long a queued request waits for a free connection so a
            // slow query cannot pile the whole request backlog into memory.
            waitQueueTimeoutMS: 10000,
            compressors: ['zlib'],
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