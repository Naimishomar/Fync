import mongoose from 'mongoose';

const clubMessageSchema = new mongoose.Schema({
    subGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubGroup', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String },
    
    // File/Media Support (Cloudflare R2)
    fileUrl: { type: String },
    fileType: { type: String, enum: ['image', 'video', 'pdf', 'doc', 'link'] },
    fileName: { type: String },
    fileSize: { type: String },

    // WhatsApp-style features
    repliedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'ClubMessage' },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    reactions: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        emoji: { type: String }
    }],

    // Advanced features
    isPoll: { type: Boolean, default: false },
    pollQuestion: { type: String },
    pollOptions: [{
        optionText: { type: String },
        votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    }],

    isPinned: { type: Boolean, default: false }
}, { timestamps: true });

// Message cleanup index: delete after 365 days (1 year) for clubs
clubMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

const ClubMessage = mongoose.model('ClubMessage', clubMessageSchema);
export default ClubMessage;
