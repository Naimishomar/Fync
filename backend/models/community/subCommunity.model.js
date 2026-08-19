import mongoose from 'mongoose';

const subCommunitySchema = new mongoose.Schema({
    communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true },
    name: { type: String, required: true },
    logo: { type: String },
    description: { type: String },
    // 'feed' is a subreddit: titled posts, votes, threaded comments. 'chat' and
    // 'announcement' are the original live-message rooms and are unchanged.
    type: { type: String, enum: ['chat', 'announcement', 'feed'], default: 'chat' },
}, { timestamps: true });

// Every sub-community list is fetched by parent community.
subCommunitySchema.index({ communityId: 1 });

const SubCommunity = mongoose.model('SubCommunity', subCommunitySchema);
export default SubCommunity;
