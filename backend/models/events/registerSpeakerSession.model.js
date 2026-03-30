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
const RegisterSpeakerSession = mongoose.model('RegisterSpeakerSession', RegisterSpeakerSessionSchema);  
export default RegisterSpeakerSession;