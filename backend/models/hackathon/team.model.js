import mongoose from "mongoose";
const teamSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    hackathon: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Hackathon",
        required: true,
    },
    leader: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    members: [
        {
            user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            role: { type: String, enum: ["leader", "member"], default: "member" },
            joinedAt: { type: Date, default: Date.now }
        }
    ],
    invites: [
        {
            to: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            status: { type: String, enum: ["accepted", "pending", "declined"], default: "pending" },
            sentAt: { type: Date, default: Date.now }
        }
    ],
    joinRequests: [
        {
            from: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            message: { type: String, required: true },
            status: { type: String, enum: ["accepted", "pending", "declined"], default: "pending" },
             sentAt: { type: Date, default: Date.now }
        }
    ],
    requiredSkills: [{ type: String }],
    description: { type: String },
    isLocked: { type: Boolean, default: false },
    lookingForMembers: { type: Boolean, default: true },
}, { timestamps: true })

// Hot query paths:
//  - getMyHackathons: "members.user" membership lookup per hackathon
//  - createTeam/requesttoJoin/RespondtoInvite: one team per user per hackathon
//  - matchTeams: open teams for skill matching
teamSchema.index({ hackathon: 1, "members.user": 1 });
teamSchema.index({ hackathon: 1, lookingForMembers: 1, isLocked: 1 });

const HackathonTeam = mongoose.model("HackathonTeam", teamSchema);
export default HackathonTeam;