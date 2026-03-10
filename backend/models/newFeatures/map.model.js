import mongoose from 'mongoose';

const mapSchema = new mongoose.Schema({
    college: {
        type: String,
        index: true
    },
    lat: {
        type: Number,
    },
    lng: {
        type: Number,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        // Auto-delete documents after 1 hour — keeps heatmap current, prevents DB bloat
        expires: 3600
    }
});

const Map = mongoose.model('Map', mapSchema);
export default Map;