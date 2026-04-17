import Opportunity from "../models/opportunity.model.js";
import User from "../models/user.model.js";

export const createOpportunity = async (req, res) => {
    try {
        const { 
            title, company, location, type, opportunityType, 
            duration, stipend, description, applicationLink 
        } = req.body;

        if (!title || !company || !type || !description || !applicationLink) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        const user = await User.findById(req.user.id);
        if (!user || user.user_access !== 'recruiter' && user.user_access !== 'admin') {
            return res.status(403).json({ success: false, message: "Unauthorized. Only recruiters can post opportunities." });
        }

        const newOpportunity = await Opportunity.create({
            title,
            company,
            companyLogo: user.avatar || "", // Fallback to recruiter's avatar as company logo if not provided
            location,
            type,
            opportunityType,
            duration,
            stipend,
            description,
            applicationLink,
            postedBy: req.user.id
        });

        res.status(201).json({ success: true, message: "Opportunity posted successfully", opportunity: newOpportunity });
    } catch (error) {
        console.error("Error creating opportunity:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getOpportunities = async (req, res) => {
    try {
        const { type, page = 1, limit = 15, search = "" } = req.query;
        const filter = { isActive: true };
        
        if (type) filter.type = type;
        if (search) {
            filter.$or = [
                { title: new RegExp(search, 'i') },
                { company: new RegExp(search, 'i') },
                { description: new RegExp(search, 'i') }
            ];
        }

        const skip = (page - 1) * limit;

        const opportunities = await Opportunity.find(filter)
            .populate("postedBy", "name username avatar company")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Opportunity.countDocuments(filter);

        res.status(200).json({ 
            success: true, 
            data: opportunities, 
            hasMore: skip + opportunities.length < total 
        });
    } catch (error) {
        console.error("Error fetching opportunities:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const deleteOpportunity = async (req, res) => {
    try {
        const opportunity = await Opportunity.findById(req.params.id);
        if (!opportunity) {
            return res.status(404).json({ success: false, message: "Opportunity not found" });
        }

        if (opportunity.postedBy.toString() !== req.user.id && req.user.user_access !== 'admin') {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        await Opportunity.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: "Opportunity deleted" });
    } catch (error) {
        console.error("Error deleting opportunity:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
