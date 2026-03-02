import mongoose from "mongoose";

const paidGigsSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    stipend: {
        type: String,
        default: 'Not disclosed'
    },
    postedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    postedUserCollege: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Open', 'Closed'],
        default: 'Open'
    },
    visibility:{
        type: String,
        enum: ['College', 'Global'],
        required: true,
        default: 'Global'
    }
}, { timestamps: true });

const PaidGigs = mongoose.model('PaidGigs', paidGigsSchema);
export default PaidGigs;