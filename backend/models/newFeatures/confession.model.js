import mongoose from "mongoose";

const confessionSchema = new mongoose.Schema({
    content: {
        type: String,
        required: true,
        trim: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    college: {
        type: String,
        required: true,
        index: true,
    },
    color: {
        type: String,
        default: "#FF6B6B",
    },
    likes: {
        type: Number,
        default: 0,
    },
    liked_by: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    }],
    taggedUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
    comments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment",
    }],
}, { timestamps: true });


confessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

const Confession = mongoose.model("Confession", confessionSchema);
export default Confession;
