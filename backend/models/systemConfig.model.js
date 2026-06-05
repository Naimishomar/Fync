import mongoose from 'mongoose';

const systemConfigSchema = new mongoose.Schema({
    subscriptionPrice: {
        type: Number,
        default: 49 // Default base price
    },
    isSubscriptionEnabled: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

const SystemConfig = mongoose.model('SystemConfig', systemConfigSchema);
export default SystemConfig;
