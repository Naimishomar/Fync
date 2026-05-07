import mongoose from 'mongoose';

const shortsSchema = new mongoose.Schema({
    video: {
        type: String,
        required: true
    },
    title:{
        type: String,
        required: true
    },
    description:{
        type: String,
    },
    likes: {
        type: Number,
        default: 0,
        required: true,
    },
    liked_by:{
        type: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            index: true,
        },
        ],
        default: [],
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    comments: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Comment",
        },
    ],
    views: {
        type: Number,
        default: 0,
        required: true,
    },
}, {timestamps: true});

shortsSchema.index({ user: 1, _id: -1 });
shortsSchema.index({ views: -1 });
shortsSchema.index({ likes: -1 });
shortsSchema.index({ createdAt: -1 });

const Shorts = mongoose.model('Shorts', shortsSchema);
export default Shorts;