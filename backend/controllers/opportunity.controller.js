import Opportunity from "../models/opportunity.model.js";
import User from "../models/user.model.js";
import Application from "../models/application.model.js";
import Notification from "../models/notification.model.js";
import { sendPushNotification } from "../utils/notification.js";
import sendMail from "../utils/emailOtp.js";

export const createOpportunity = async (req, res) => {
    try {
        const { 
            title, company, location, type, opportunityType, 
            duration, stipend, description, applicationLink,
            isPaid, requireResume, experience
        } = req.body;

        if (!title || !company || !type || !description) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        if (!req.file || !req.file.path) {
            return res.status(400).json({ success: false, message: "Company logo is required" });
        }

        const user = await User.findById(req.user.id);
        if (!user || (user.user_access !== 'recruiter' && user.user_access !== 'admin')) {
            return res.status(403).json({ success: false, message: "Unauthorized. Only recruiters can post opportunities." });
        }

        const newOpportunity = await Opportunity.create({
            title,
            company,
            companyLogo: req.file.path,
            location,
            type,
            opportunityType,
            duration,
            isPaid: isPaid === 'true' || isPaid === true,
            stipend: (isPaid === 'true' || isPaid === true) ? stipend : "Unpaid",
            description,
            applicationLink,
            requireResume: requireResume === 'true' || requireResume === true,
            experience: experience || "fresher",
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
        const { type, page = 1, limit = 15, search = "", recruiterId } = req.query;
        const filter = { isActive: true };
        
        if (type) filter.type = type;
        if (recruiterId) filter.postedBy = recruiterId;
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

        // Enrich with hasApplied if user is logged in
        const userId = req.user?.id;
        let enrichedData = opportunities;
        if (userId) {
            enrichedData = await Promise.all(opportunities.map(async (opt) => {
                const hasApplied = await Application.exists({ 
                    opportunity: opt._id, 
                    candidate: userId 
                });
                return { ...opt.toObject(), hasApplied: !!hasApplied };
            }));
        }

        res.status(200).json({ 
            success: true, 
            data: enrichedData, 
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

export const updateOpportunity = async (req, res) => {
    try {
        const { id } = req.params;
        const opportunity = await Opportunity.findById(id);
        
        if (!opportunity) {
            return res.status(404).json({ success: false, message: "Opportunity not found" });
        }

        if (opportunity.postedBy.toString() !== req.user.id && req.user.user_access !== 'admin') {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        const allowed = [
            "title", "company", "location", "type", "opportunityType", 
            "duration", "stipend", "description", "applicationLink",
            "isPaid", "requireResume", "isActive", "experience"
        ];

        allowed.forEach(field => {
            if (req.body[field] !== undefined) {
                // Handle booleans from multipart/form-data
                if (field === 'isPaid' || field === 'requireResume' || field === 'isActive') {
                    opportunity[field] = req.body[field] === 'true' || req.body[field] === true;
                } else {
                    opportunity[field] = req.body[field];
                }
            }
        });

        if (req.file) {
            opportunity.companyLogo = req.file.path;
        }

        await opportunity.save();
        res.status(200).json({ success: true, message: "Opportunity updated", data: opportunity });
    } catch (error) {
        console.error("Error updating opportunity:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// --- CANDIDATE ENDPOINTS ---

export const applyToOpportunity = async (req, res) => {
    try {
        const { id } = req.params;
        const { coverLetter } = req.body || {};

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
        if (opportunity.requireResume && !candidate.resumeUrl) {
            return res.status(400).json({ success: false, message: "This opportunity requires a resume. Please upload one in your profile first." });
        }

        const portfolioUrl = `/profile/resume/${candidate._id}/pdf`;

        const application = await Application.create({
            opportunity: id,
            candidate: req.user.id,
            recruiter: opportunity.postedBy,
            coverLetter,
            resume: candidate.resumeUrl || "", 
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
        const { status } = req.body || {};

        const application = await Application.findById(id);
        if (!application) {
            return res.status(404).json({ success: false, message: "Application not found" });
        }

        if (application.recruiter.toString() !== req.user.id && req.user.user_access !== 'admin') {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        application.status = status;
        await application.save();

        // Populate after saving to avoid ID/Object conflicts and satisfy notification needs
        await application.populate("opportunity");

        // ── Notify candidate based on status change ───────────────────────
        if (status === 'shortlisted') {
            const candidate = await User.findById(application.candidate);
            if (candidate?.expoPushToken) {
                await sendPushNotification(
                    candidate.expoPushToken,
                    "🎉 You've been Shortlisted!",
                    `Congratulations! You have been shortlisted for ${application.opportunity.title}. Check your dashboard.`
                );
            }
            await Notification.create({
                recipient: application.candidate,
                sender: req.user.id,
                type: 'opportunity',
                message: `🎉 You were shortlisted for "${application.opportunity.title}"! The recruiter will reach out soon.`
            });
        }

        if (status === 'rejected') {
            const candidate = await User.findById(application.candidate);
            const recruiter = await User.findById(req.user.id).select('name company');
            const companyName = recruiter?.company || recruiter?.name || 'the company';

            if (candidate?.expoPushToken) {
                await sendPushNotification(
                    candidate.expoPushToken,
                    "Application Update",
                    `We're sorry, your application for ${application.opportunity.title} at ${companyName} was not selected. Keep applying!`
                ).catch(e => console.log("Push error:", e));
            }
            await Notification.create({
                recipient: application.candidate,
                sender: req.user.id,
                type: 'opportunity',
                message: `Your application for "${application.opportunity.title}" at ${companyName} was not selected. Don't give up — keep exploring opportunities on Fync!`
            });
        }

        res.status(200).json({ success: true, message: `Application status updated to ${status}` });
    } catch (error) {
        console.error("Error updating status:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const notifyShortlistedCandidates = async (req, res) => {
    try {
        const { opportunityId, message } = req.body;
        if (!opportunityId || !message) {
            return res.status(400).json({ success: false, message: "Opportunity ID and message are required" });
        }

        const opportunity = await Opportunity.findById(opportunityId);
        if (!opportunity) return res.status(404).json({ success: false, message: "Opportunity not found" });

        if (opportunity.postedBy.toString() !== req.user.id && req.user.user_access !== 'admin') {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        const applications = await Application.find({ 
            opportunity: opportunityId, 
            status: 'shortlisted' 
        }).populate("candidate", "name email expoPushToken");

        if (applications.length === 0) {
            return res.status(200).json({ success: true, message: "No shortlisted candidates to notify" });
        }

        const notificationPromises = applications.map(async (app) => {
            const candidate = app.candidate;
            if (!candidate) return;

            // Push Notification
            if (candidate.expoPushToken) {
                sendPushNotification(
                    candidate.expoPushToken,
                    `Update: ${opportunity.title}`,
                    message
                ).catch(e => console.log("Push error", e));
            }

            // In-app Notification
            Notification.create({
                recipient: candidate._id,
                sender: req.user.id,
                type: 'opportunity',
                message: message
            }).catch(e => console.log("DB Notification error", e));
        });

        await Promise.all(notificationPromises);

        res.status(200).json({ success: true, message: `Notifications sent to ${applications.length} candidates` });
    } catch (error) {
        console.error("Error notifying candidates:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

