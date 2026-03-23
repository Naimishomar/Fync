import mongoose from "mongoose";

const placementPredictionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    gpa: {
        type: Number,
        required: true
    },
    resumeText: {
        type: String,
        required: true
    },
    resumeHash: {
        type: String,
        required: true
    },
    analysis: {
        type: Object,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const PlacementPrediction = mongoose.model("PlacementPrediction", placementPredictionSchema);
export default PlacementPrediction;
