import mongoose from 'mongoose';

const mapSchema = new mongoose.Schema({
    college:{
        type: String,
        index: true
    },
    lat:{
        type: Number,
    },
    lng:{
        type: Number,
    }
});

const Map = mongoose.model('Map', mapSchema);
export default Map;