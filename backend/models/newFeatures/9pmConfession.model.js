import mongoose from "mongoose";

const NinePMConfessionSchema = new mongoose.Schema({
    participants: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User" 
    }],
    college: { type: String, required: true },
    status: { 
        type: String, 
        enum: ['ACTIVE', 'REVEALED', 'FAILED'], 
        default: 'ACTIVE' 
    },
    messages: [{
        sender: String,
        text: String,
        timestamp: { type: Date, default: Date.now }
    }],
    revealVotes: [{ type: mongoose.Schema.Types.ObjectId }],
    createdAt: { type: Date, default: Date.now, expires: 86400 }
});

const NineAMConfession = mongoose.model("Lottery", NinePMConfessionSchema);
export default NineAMConfession;