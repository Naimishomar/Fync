import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    username:{
        type:String,
        required:true,
        unique:true,
        sparse: true
    },
    email:{
        type:String,
        required:true,
        unique:true,
        sparse: true
    },
    mobileNumber:{
        type: String,
        required: true,
        unique: true,
        sparse: true
    },
    password:{
        type:String,
        required:true
    },
    dob:{
        type:Date,
        required: true
    },
    college:{
        type: String,
        required: true,
    },
    year:{
        type:Number,
        required: true
    },
    major:{
        type:String,
        required: true
    },
    gender:{
        type:String,
        required: true,
        enum: ['Male', 'Female']
    },
    avatar:{
        type:String,
        default: 'https://cdn-icons-png.freepik.com/512/219/219988.png'
    },
    banner:{
        type:String,
        default: 'https://cdn.pixabay.com/photo/2015/10/29/14/38/web-1012467_1280.jpg'
    },
    is_subscribed:{
        type:Boolean,
        default:false
    },
    followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
    }],
    following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
    }],
    linkedIn_id:{
        type:String,
        sparse: true
    },
    github_id:{
        type:String,
        sparse: true
    },
    interest:{
        type: [String]
    },
    hobbies:{
        type: [String]
    },
    user_access:{
        type: String,
        enum: ['admin', 'user'],
        default: 'user'
    },
    about:{
        type: String,
    },
    skills:{
        type: [String]
    },
    experience:{
        type: String
    },
},{timestamps:true});

const User = mongoose.model('User', userSchema);
export default User;