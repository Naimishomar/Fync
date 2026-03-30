import mongoose from 'mongoose';

const communityMessageSchema = new mongoose.Schema({
    subCommunityId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubCommunity', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String },
    image: { type: String },
    video: { type: String },
    repliedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityMessage' },
}, { timestamps: true });

communityMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const CommunityMessage = mongoose.model('CommunityMessage', communityMessageSchema);
export default CommunityMessage;
