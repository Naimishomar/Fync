import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    sender: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User", 
        required: true 
    },
    receiver: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User", 
        required: true 
    },
    product: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "OLX", 
        required: false 
    },
    message: { 
        type: String, 
        required: true 
    },
    seen: { 
        type: Boolean, 
        default: false 
    }
}, { timestamps: true });

const Message = mongoose.model("Message", messageSchema);
export default Message;
