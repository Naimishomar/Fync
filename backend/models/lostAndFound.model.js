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
// The schema had no timestamps at all, so items had no creation time to sort or
// paginate by -- the list endpoints returned them in natural storage order.
}, { timestamps: true })


// Both list endpoints filter on { college, lostOrFound } and want newest first.
LostAndFoundSchema.index({ college: 1, lostOrFound: 1, createdAt: -1 });

const LostAndFound = mongoose.model('LostAndFound', LostAndFoundSchema);
export default LostAndFound;