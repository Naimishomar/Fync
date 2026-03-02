import PaidGigs from "../models/paidGigs.model.js";

export const createPaidGigs = async (req, res) => {
    try {
       const { title, description, stipend, visibility } = req.body; 
       if(!title || !description){
           return res.status(400).json({ success: false, message: "Please provide all the required fields" });
       }
       const createGig = await PaidGigs.create({
           title,
           description,
           stipend: stipend || 'Not disclosed',
           postedBy: req.user.id,
           postedUserCollege: req.user.college,
           status: 'Open',
           visibility: visibility || 'Global'
       });
       return res.status(200).json({ success: true, message: "Gig created successfully", gig: createGig });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const getPaidGigs = async (req, res) => {
    try {
        const { query } = req.query;
        let getGig;
        if (query === 'all') {
            getGig = await PaidGigs.find({ status: 'Open', visibility: 'Global' })
            .populate("postedBy", "name username avatar")
            .sort({ createdAt: -1 });
        } 
        else if (query === 'college') {
            getGig = await PaidGigs.find({ status: 'Open', visibility: 'College', postedUserCollege: req.user.college })
            .populate("postedBy", "name username avatar")
            .sort({ createdAt: -1 });
        } 
        else {
            getGig = await PaidGigs.find({ status: 'Open' })
            .populate("postedBy", "name username avatar")
            .sort({ createdAt: -1 });
        }
        if (!getGig || getGig.length === 0) {
            return res.status(404).json({ success: false, message: "Gigs not found" });
        }
        return res.status(200).json({ success: true, message: "Gigs fetched successfully", gigs: getGig });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const updatePaidGigs = async (req, res) => {
    try {
        const { title, description, stipend } = req.body;
        const gig = await PaidGigs.findById(req.params.id);
        if (!gig) {
            return res.status(404).json({ success: false, message: "Gig not found" });
        }
        if (gig.postedBy.toString() !== req.user.id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        else{
            const updatedGig = await PaidGigs.findByIdAndUpdate(
                req.params.id,
                {
                    $set: {
                        ...(title && { title }),
                        ...(description && { description }),
                        ...(stipend && { stipend }),
                    },
                },
                {new: true}
            );
            return res.status(200).json({ success: true, message: "Gig updated successfully", gig: updatedGig });
        }
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const changeGigStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const gig = await PaidGigs.findById(req.params.id);
        if (!gig) {
            return res.status(404).json({ success: false, message: "Gig not found" });
        }
        const postedById = gig.postedBy._id ? gig.postedBy._id.toString() : gig.postedBy.toString();
        if (postedById !== req.user.id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        if (status === 'Closed') {
            await PaidGigs.findByIdAndDelete(req.params.id);
            return res.status(200).json({ success: true, message: "Gig closed and removed successfully" });
        } 
        else {
            const updatedGig = await PaidGigs.findByIdAndUpdate(
                req.params.id,
                { $set: { status } },
                { new: true }
            );
            return res.status(200).json({ success: true, message: "Gig status updated successfully", gig: updatedGig });
        }
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const deleteGigs = async(req,res)=>{
    try {
        const gig = await PaidGigs.findById(req.params.id);
        if (!gig) {
            return res.status(404).json({ success: false, message: "Gig not found" });
        }
        if (gig.postedBy.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        else{
            const deleteGig = await PaidGigs.findByIdAndDelete(req.params.id);
            return res.status(200).json({message:"Gig deleted successfully", deleteGig});
        }
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({message:"Internal server error"});
    }
}

export const getYourPostedGigs = async(req,res)=>{
    try {
        const yourGigs = await PaidGigs.find({postedBy: req.user.id})
        .populate("postedBy", "name username avatar")
        .sort({createdAt: -1});
        if(!yourGigs){
            return res.status(404).json({message:"No gigs found"});
        }
        return res.status(200).json({message:"Your gigs fetched successfully", yourGigs});
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({message:"Internal server error"});   
    }
}