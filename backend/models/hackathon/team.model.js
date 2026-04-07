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
            user: { type: mongoose.Schema.Types.ObjectId },
            role: { type: String, enum: ["leader", "member"], default: "member" },
            joinedAt: { type: Date, default: Date.now() }
        }
    ],
    invites: [
        {
            to: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            status: { type: String, enum: ["accepted", "pending", "declined"], default: "pending" },
            sentAt: { type: Date, default: Date.now() }
        }
    ],
    joinRequests: [
        {
            from: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            message: { type: String, required: true },
            status: { type: String, enum: ["accepted", "pending", "declined"], default: "pending" },
             sentAt: { type: Date, default: Date.now() }
        }
    ],
    requiredSkills: [{ type: String }],
    description: { type: String },
    isLocked: { type: Boolean, default: false },
    lookingForMembers: { type: Boolean, default: true },
}, { timestamps: true })
const HackathonTeam = mongoose.model("HackathonTeam", teamSchema);
export default HackathonTeam;