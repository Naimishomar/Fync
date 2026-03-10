import mongoose from "mongoose";

const apiPlaygroundLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    username: {
        type: String,
        required: true
    },
    method: {
        type: String,
        required: true,
        enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    },
    endpoint: {
        type: String,
        required: true
    },
    requestBody: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    responseStatus: {
        type: Number
    },
    responseData: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

const ApiPlaygroundLog = mongoose.model('ApiPlaygroundLog', apiPlaygroundLogSchema);
export default ApiPlaygroundLog;
