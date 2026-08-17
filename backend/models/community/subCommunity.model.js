import mongoose from 'mongoose';

const subCommunitySchema = new mongoose.Schema({
    communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true },
    name: { type: String, required: true },
    logo: { type: String },
    description: { type: String },
    type: { type: String, enum: ['chat', 'announcement'], default: 'chat' },
}, { timestamps: true });

// Every sub-community list is fetched by parent community.
subCommunitySchema.index({ communityId: 1 });

const SubCommunity = mongoose.model('SubCommunity', subCommunitySchema);
export default SubCommunity;
