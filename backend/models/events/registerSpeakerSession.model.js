import mongoose from 'mongoose';

const RegisterSpeakerSessionSchema = new mongoose.Schema({
    eventId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SpeakerSession'
    },
    userId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isPaid:{
        type: Boolean,
        required: true,
        default: false
    },
    qrCode:{
        type: String
    },
    isPresent:{
        type: Boolean,
        default: false
    }
});
// The controller guards double-registration with a findOne-then-create, which
// two concurrent requests can both pass. Enforce it in the database instead.
RegisterSpeakerSessionSchema.index({ eventId: 1, userId: 1 }, { unique: true });
// "my registered sessions" listing.
RegisterSpeakerSessionSchema.index({ userId: 1, isPaid: 1 });

const RegisterSpeakerSession = mongoose.model('RegisterSpeakerSession', RegisterSpeakerSessionSchema);  
export default RegisterSpeakerSession;