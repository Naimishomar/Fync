import mongoose from "mongoose";

const speakerSchema = new mongoose.Schema({
    eventId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SpeakerSession'
    },
    name:{
        type: String,
        required: true
    },
    image:{
        type: String,
        required: true
    },
    designation:{
        type: String,
        required: true
    }
})

const Speaker = mongoose.model('Speaker', speakerSchema);
export default Speaker;