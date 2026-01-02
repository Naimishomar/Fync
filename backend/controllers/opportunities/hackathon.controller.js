import Hackathon from '../../models/opportunities/hackathon.model.js';
import User from '../../models/user.model.js';

export const createHackathon = async(req,res)=>{
    try {
        const { name, description, start_date, time_duration, location } = req.body;
        if (!name || !description || !start_date || !time_duration || !location) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }
        const posted_by = await User.findById(req.user.id);
        if(posted_by.email !== 'naimishomar@gmail.com'){
            return res.status(400).json({ success: false, message: "You are not authorized to create a hackathon" });
        }
        const hackathon = await Hackathon.create({
            name,
            description,
            start_date,
            time_duration,
            location,
            posted_by: req.user.id
        });
        return res.status(200).json({ message:"Hackathon created successfully", success: true, hackathon });
    } catch (error) {
        console.log("Internal server error", error);
        res.status(500).send("Error creating hackathon");
    }
}

export const getHackathon = async(req,res)=>{
    try {
        const hackathons = await Hackathon.find();
        if(!hackathons) return res.status(404).json({ success: false, message: "No hackathons found" });
        return res.status(200).json({ success: true, hackathons });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).send("Error fetching hackathons");
    }
}

export const getHackathonById = async(req,res)=>{
    try {
        const hackathon = await Hackathon.findById(req.params.id);
        if(!hackathon) return res.status(404).json({ success: false, message: "Hackathon not found" });
        return res.status(200).json({ success: true, hackathon });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).send("Error fetching hackathon");
    }
}

export const updateHackathon = async (req, res) => {
    try {
        const hackathon = await Hackathon.findById(req.params.id);
        if (!hackathon) { 
            return res.status(404).json({success: false,message: "Hackathon not found",});
        }
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(401).json({ success: false, message: "Unauthorized"});
        }
        if (user.email !== "naimishomar@gmail.com") {
            return res.status(403).json({ success: false, message: "You are not authorized to update a hackathon"});
        }
        const updatedHackathon = await Hackathon.findByIdAndUpdate(req.params.id,
            {
                $set: req.body,
            },
            { new: true, runValidators: true }
        );
        return res.status(200).json({ success: true, message: "Hackathon updated successfully", updatedHackathon });
    } catch (error) {
        console.error("Internal server error:", error);
        return res.status(500).json({ success: false, message: "Error updating hackathon"});
    }
};

export const deleteHackathon = async (req, res) => {
    try {
        const hackathon = await Hackathon.findById(req.params.id);
        if (!hackathon) {
            return res.status(404).json({ success: false, message: "Hackathon not found" });
        }
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        if (user.email !== "naimishomar@gmail.com") {
            return res.status(403).json({ success: false, message: "You are not authorized to delete a hackathon" });
        }
        await Hackathon.findByIdAndDelete(req.params.id);
        return res.status(200).json({ success: true, message: "Hackathon deleted successfully" });
    } catch (error) {
        console.error("Internal server error:", error);
        return res.status(500).json({ success: false, message: "Error deleting hackathon" });
    }
};