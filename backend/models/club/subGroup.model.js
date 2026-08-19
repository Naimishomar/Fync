import mongoose from 'mongoose';

const subGroupSchema = new mongoose.Schema({
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
    name: { type: String, required: true },
    description: { type: String },
    logo: { type: String }, // R2 URL
    type: { type: String, enum: ['chat', 'announcement'], default: 'chat' },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    joinRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    pinnedMessages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ClubMessage' }],
    isPrivate: { type: Boolean, default: true },
    isGeneral: { type: Boolean, default: false },
    onlyAdminsCanMessage: { type: Boolean, default: false },
}, { timestamps: true });


// Rooms are always looked up by their parent club.
subGroupSchema.index({ clubId: 1 });

const SubGroup = mongoose.model('SubGroup', subGroupSchema);
export default SubGroup;
