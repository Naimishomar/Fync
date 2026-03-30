import mongoose from 'mongoose';

const CreateSpeakerSessionSchema = new mongoose.Schema({
    eventId:{
        type: Number,
        required: true,
        unique: true
    },
    admin_email:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    eventName:{
        type: String,
        required: true
    },
    description:{
        type: String,
        required: true
    },
    college:{
        type: String,
        required: true
    },
    venue:{
        type: String,
        required: true
    },
    date:{
        type: Date,
        required: true
    },
    startTime:{
        type: String,
        required: true
    },
    endTime:{
        type: String,
        required: true
    },
    admin_upi_id:{
        type: String
    },
    userLimit:{
        type: Number
    },
    speakers:[{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Speaker'
    }],
    agenda:{
        type: String
    },
    fee:{
        type: Number
    },
    logo:{
        type: String
    },
    banner:{
        type: String
    },
    status:{
        type: String,
        enum: ['open', 'closed'],
        default: 'open'
    },
    isCollegeSpecific: {
        type: Boolean,
        default: false
    },
    secondaryAdmins: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    isCommunityActive: {
        type: Boolean,
        default: true
    },
    contactDetails: [{
        name: String,
        mobile: String,
        email: String
    }]
})

const CreateSpeakerSession = mongoose.model('SpeakerSession', CreateSpeakerSessionSchema);
export default CreateSpeakerSession;