import mongoose from "mongoose";

const confessionSchema = new mongoose.Schema({
    senderId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    collegeName:{
        type: String,
        required: true
    },
    message:{
        type: String,
        required: true
    },
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    isBanned:{
        type: Boolean,
        default: false,
    },
    createdAt:{
        type: Date,
        default: Date.now,
        expires: 60 * 60 * 24 * 7,
    },
}, {timestamps: true});

const Confession = mongoose.model("Confession", confessionSchema);
export default Confession;