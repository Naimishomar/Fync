import mongoose from 'mongoose';

const EventMessageSchema = new mongoose.Schema({
    eventId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    eventModel: {
        type: String,
        enum: ['Bootcamp', 'SpeakerSession'],
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    text: {
        type: String,
        required: true
    },
    image: {
        type: String
    },
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EventMessage'
    }
}, { timestamps: true });


// Covers the list query's filter AND its sort; without it the sort ran in
// memory over every matching document.
EventMessageSchema.index({ eventId: 1, eventModel: 1, createdAt: 1 });

const EventMessage = mongoose.model('EventMessage', EventMessageSchema);
export default EventMessage;
