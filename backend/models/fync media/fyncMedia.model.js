import mongoose from "mongoose";

const FyncMediaSchema = new mongoose.Schema({
    title:{
        type: String,
        required: true,
        maxlength: 100,
        minlength: 5,
    },
    description:{
        type: String,
        required: true,
        maxlength: 300,
        minlength: 10,
    },
    thumbnail:{
        type: String,
        required: true,
    },
    video_link:{
        type: String,
        required: true,
    },
    admin:{
        type: mongoose.Schema.ObjectId,
        ref: "User"
    },
    date:{
        type: Date,
        default: Date.now,
        required: true,
    },
    likes:{
        type: Number,
        default: 0,
    },
    liked_by: [{
        type: mongoose.Schema.ObjectId,
        ref: "User"
    }],
    dislikes:{
        type: Number,
        default: 0,
    },
    disliked_by: [{
        type: mongoose.Schema.ObjectId,
        ref: "User"
    }],
    comment:[{
        type: mongoose.Schema.ObjectId,
        ref: "Comment"
    }],
    tags:[{
        type: String,
    }],
    duration: {
        type: String,
        default: "0:00"
    }
},{timestamps:true});


// Covers the list query's filter AND its sort; without it the sort ran in
// memory over every matching document.
FyncMediaSchema.index({ createdAt: -1 });

const FyncMedia = mongoose.model('FyncMedia', FyncMediaSchema);
export default FyncMedia;