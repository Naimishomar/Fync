import mongoose from "mongoose";

const jobOpeningSchema = new mongoose.Schema({
    alumni: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    applyLink: {
        type: String,
        required: true
    },
    salary: {
        type: String,
        default: "Not disclosed"
    },
    college: {
        type: String,
        required: true,
        index: true
    },
    comments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment"
    }]
}, { timestamps: true });

const JobOpening = mongoose.model("JobOpening", jobOpeningSchema);
export default JobOpening;
