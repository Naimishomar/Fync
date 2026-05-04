import mongoose from 'mongoose';

const systemConfigSchema = new mongoose.Schema({
    subscriptionPrice: {
        type: Number,
        default: 39 // Default base price
    },
    // Can add more global config here in the future
}, { timestamps: true });

const SystemConfig = mongoose.model('SystemConfig', systemConfigSchema);
export default SystemConfig;
