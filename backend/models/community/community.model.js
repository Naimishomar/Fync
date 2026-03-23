import mongoose from 'mongoose';

const communitySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    logo: { type: String },
    banner: { type: String },
    description: { type: String },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    socialLinks: {
        youtube: { type: String },
        github: { type: String },
        linkedin: { type: String },
        twitter: { type: String },
        website: { type: String }
    },
    subscription: {
        status: { type: String, enum: ['active', 'suspended'], default: 'active' },
        expiryDate: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        lastPaymentDate: { type: Date, default: Date.now }
    }
}, { timestamps: true });

const Community = mongoose.model('Community', communitySchema);
export default Community;
