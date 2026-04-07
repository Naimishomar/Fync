import ContactUs from "../../models/contact us/ContactUs.model.js";

export const contactUs = async (req, res) => {
    try {
        const { name, phone, email, message } = req.body;
        if (!name || !phone || !email || !message) {
            return res.status(400).json({ message: "All fields are required" });
        }
        const images = req.files ? req.files.map(file => file.path) : [];
        
        const contactEntry = await ContactUs.create({
            name,
            phone,
            email,
            message,
            images
        })
        if (!contactEntry) {
            return res.status(400).json({ message: "Failed to submit contact us form" });
        }
        return res.status(201).json({ message: "Contact us form submitted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
}