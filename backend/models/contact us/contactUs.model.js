import mongoose from "mongoose";

const contactUsSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    images: {
        type: [String],
        default: []
    }
}, { timestamps: true });

const ContactUs = mongoose.model("ContactUs", contactUsSchema);

export default ContactUs;