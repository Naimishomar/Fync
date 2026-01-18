import mongoose from "mongoose";

const LostAndFoundSchema = new mongoose.Schema({
    item:{
        type: String,
        required: true
    },
    image:{
        type: String,
    },
    lostOrFound:{
        type: String,
        enum: ['lost', 'found'],
        required: true
    },
    found_or_lost_by:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    place:{
        type: String,
    },
    college:{
        type: String,
        required: true
    },
    is_found_item_claimed:{
        type: Boolean,
        default: false
    },
    is_lost_item_found:{
        type: Boolean,
        default: false
    },
    claimed_by:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    claimed_at:{
        type: Date,
        index: { expires: '24h' }
    }
})

const LostAndFound = mongoose.model('LostAndFound', LostAndFoundSchema);
export default LostAndFound;