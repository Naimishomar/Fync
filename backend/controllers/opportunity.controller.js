import Opportunity from "../models/opportunity.model.js";
import User from "../models/user.model.js";
import Application from "../models/application.model.js";

export const createOpportunity = async (req, res) => {
    try {
        const { 
            title, company, location, type, opportunityType, 
            duration, stipend, description, applicationLink,
            isPaid, requireResume
        } = req.body;

        if (!title || !company || !type || !description) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        const user = await User.findById(req.user.id);
        if (!user || (user.user_access !== 'recruiter' && user.user_access !== 'admin')) {
            return res.status(403).json({ success: false, message: "Unauthorized. Only recruiters can post opportunities." });
        }

        const newOpportunity = await Opportunity.create({
            title,
            company,
            companyLogo: user.avatar || "",
            location,
            type,
            opportunityType,
            duration,
            isPaid,
            stipend: isPaid ? stipend : "Unpaid",
            description,
            applicationLink,
            requireResume,
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

// --- CANDIDATE ENDPOINTS ---

export const applyToOpportunity = async (req, res) => {
    try {
        const { id } = req.params;
        const { coverLetter, resume } = req.body;

        const opportunity = await Opportunity.findById(id);
        if (!opportunity) {
            return res.status(404).json({ success: false, message: "Opportunity not found" });
        }

        // Check if already applied
        const existingApplication = await Application.findOne({
            opportunity: id,
            candidate: req.user.id
        });

        if (existingApplication) {
            return res.status(400).json({ success: false, message: "You have already applied for this opportunity" });
        }

        const candidate = await User.findById(req.user.id);
        if (!candidate) return res.status(404).json({ success: false, message: "User not found" });

        // If recruiter requires resume and candidate doesn't have one
        if (opportunity.requireResume && !resume && !candidate.resumeUrl) {
            return res.status(400).json({ success: false, message: "This opportunity requires a resume. Please upload one in your profile first." });
        }

        const portfolioUrl = `https://fync.in/portfolio/${candidate.username}`;

        const application = await Application.create({
            opportunity: id,
            candidate: req.user.id,
            recruiter: opportunity.postedBy,
            coverLetter,
            resume: resume || candidate.resumeUrl || "", 
            portfolioUrl: portfolioUrl
        });

        res.status(201).json({ success: true, message: "Application submitted successfully", application });
    } catch (error) {
        console.error("Error applying:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// --- RECRUITER PORTAL ENDPOINTS ---

export const getRecruiterPosts = async (req, res) => {
    try {
        const posts = await Opportunity.find({ postedBy: req.user.id }).sort({ createdAt: -1 });
        
        // Enrich posts with application counts
        const enrichedPosts = await Promise.all(posts.map(async (post) => {
            const count = await Application.countDocuments({ opportunity: post._id });
            return { ...post.toObject(), applicationCount: count };
        }));

        res.status(200).json({ success: true, data: enrichedPosts });
    } catch (error) {
        console.error("Error fetching recruiter posts:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getRecruiterApplications = async (req, res) => {
    try {
        const { opportunityId } = req.query;
        let filter = { recruiter: req.user.id };

        if (opportunityId) {
            filter.opportunity = opportunityId;
        }

        const applications = await Application.find(filter)
            .populate("candidate", "name username avatar email college graduationYear major mobileNumber")
            .populate("opportunity", "title type company")
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, data: applications });
    } catch (error) {
        console.error("Error fetching applications:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const updateApplicationStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const application = await Application.findById(id);
        if (!application) {
            return res.status(404).json({ success: false, message: "Application not found" });
        }

        if (application.recruiter.toString() !== req.user.id && req.user.user_access !== 'admin') {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        application.status = status;
        await application.save();

        res.status(200).json({ success: true, message: `Application status updated to ${status}` });
    } catch (error) {
        console.error("Error updating status:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

