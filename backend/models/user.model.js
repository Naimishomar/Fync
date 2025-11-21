import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    username:{
        type:String,
        required:true,
        unique:true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    mobileNumber:{
        type: String,
        required: true,
        unique: true
    },
    password:{
        type:String,
        required:true
    },
    dob:{
        type:Date,
        required: true
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
    },
    is_subscribed:{
        type:Boolean,
        default:false
    },
    followers:{
        type:Number,
        default:0
    },
    following:{
        type:Number,
        default:0
    },
    linkedIn_id:{
        type:String,
        unique:true
    },
    github_id:{
        type:String,
        unique:true
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