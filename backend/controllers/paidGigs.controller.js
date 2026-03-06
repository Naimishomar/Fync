import PaidGigs from "../models/paidGigs.model.js";

export const createPaidGigs = async (req, res) => {
    try {
        const { title, description, stipend, visibility } = req.body;
        if (!title || !description) {
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
        const { query, page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        let filter = { status: 'Open' };
        if (query === 'all') {
            filter.visibility = 'Global';
        } else if (query === 'college') {
            filter.visibility = 'College';
            filter.postedUserCollege = req.user.college;
        }

        const gigs = await PaidGigs.find(filter)
            .populate("postedBy", "name username avatar")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        const total = await PaidGigs.countDocuments(filter);

        if (!gigs || gigs.length === 0) {
            return res.status(404).json({ success: false, message: "Gigs not found" });
        }

        return res.status(200).json({
            success: true,
            message: "Gigs fetched successfully",
            gigs,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / limit)
            }
        });
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
        else {
            const updatedGig = await PaidGigs.findByIdAndUpdate(
                req.params.id,
                {
                    $set: {
                        ...(title && { title }),
                        ...(description && { description }),
                        ...(stipend && { stipend }),
                    },
                },
                { new: true }
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

export const deleteGigs = async (req, res) => {
    try {
        const gig = await PaidGigs.findById(req.params.id);
        if (!gig) {
            return res.status(404).json({ success: false, message: "Gig not found" });
        }
        if (gig.postedBy.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        else {
            const deleteGig = await PaidGigs.findByIdAndDelete(req.params.id);
            return res.status(200).json({ message: "Gig deleted successfully", deleteGig });
        }
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export const getYourPostedGigs = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        const yourGigs = await PaidGigs.find({ postedBy: req.user.id })
            .populate("postedBy", "name username avatar")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        const total = await PaidGigs.countDocuments({ postedBy: req.user.id });

        if (!yourGigs || yourGigs.length === 0) {
            return res.status(404).json({ message: "No gigs found" });
        }

        return res.status(200).json({
            message: "Your gigs fetched successfully",
            yourGigs,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}