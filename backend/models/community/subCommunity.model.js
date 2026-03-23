import mongoose from 'mongoose';

const subCommunitySchema = new mongoose.Schema({
    communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true },
    name: { type: String, required: true },
    logo: { type: String },
    description: { type: String },
    type: { type: String, enum: ['chat', 'announcement'], default: 'chat' },
}, { timestamps: true });

const SubCommunity = mongoose.model('SubCommunity', subCommunitySchema);
export default SubCommunity;
