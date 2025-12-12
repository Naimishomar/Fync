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
    user:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    comments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment'
    }],
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
    comments: {
        type: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Comment",
        },
        ],
        default: [],
    },
}, {timestamps: true})

const Shorts = mongoose.model('Shorts', shortsSchema);
export default Shorts;