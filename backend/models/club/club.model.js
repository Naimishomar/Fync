import mongoose from 'mongoose';

const clubSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String },
    logo: { type: String }, // R2 URL
    banner: { type: String }, // R2 URL
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    joinRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    invitations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isPrivate: { type: Boolean, default: true },
    category: { type: String }, // e.g. Technical, Cultural, Sports
    subGroups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SubGroup' }],
    pinnedMessages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ClubMessage' }],
    socialLinks: {
        youtube: String,
        github: String,
        instagram: String,
        website: String
    },
    joinCode: { type: String, unique: true, sparse: true },
    isJoinCodeEnabled: { type: Boolean, default: true }
}, { timestamps: true });


// "My clubs" is an $or over three membership arrays. Mongo can use a separate
// index per $or branch, so each array gets its own; there is no `college` field
// on a club, the scoping is by membership.
clubSchema.index({ members: 1 });
clubSchema.index({ admins: 1 });
clubSchema.index({ invitations: 1 });

const Club = mongoose.model('Club', clubSchema);
export default Club;
