import mongoose from "mongoose";

const splitGroupSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true,
        default: ""
    },
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true
    }]
}, { timestamps: true });

const SplitGroup = mongoose.model("SplitGroup", splitGroupSchema);
export default SplitGroup;
