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

// The listing for this collection is cached and shared by every user, so a
// create/update/delete must bust it. Hooking the model covers every write path,
// including ones added later.
const bustGigs = async () => {
    try {
        const { clearCacheTags } = await import('../middlewares/cache.middleware.js');
        await clearCacheTags(['gigs']);
    } catch (err) {
        console.error('Cache invalidation error:', err.message);
    }
};
paidGigsSchema.post('save', bustGigs);
paidGigsSchema.post(/^findOneAnd/, bustGigs);
paidGigsSchema.post(['updateOne', 'updateMany', 'deleteOne', 'deleteMany'], bustGigs);

const PaidGigs = mongoose.model('PaidGigs', paidGigsSchema);
export default PaidGigs;