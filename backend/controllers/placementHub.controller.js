import PlacementQuestion from "../models/newFeatures/placementHub.model.js";
import User from "../models/user.model.js";

export const addQuestion = async (req, res) => {
    try {
        const { company, role, round, type, difficulty, question, description } = req.body;
        if (!company || !role || !round || !type || !difficulty || !question) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        const newQuestion = await PlacementQuestion.create({
            company,
            role,
            round,
            type,
            difficulty,
            question,
            description,
            postedBy: req.user.id
        });

        const populated = await newQuestion.populate("postedBy", "name avatar username");
        res.status(201).json({ success: true, message: "Question shared successfully", data: populated });
    } catch (error) {
        console.error("Error in addQuestion:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getQuestions = async (req, res) => {
    try {
        const { company, role, type, difficulty, search } = req.query;
        let filter = {};
        if (company) filter.company = new RegExp(company, 'i');
        if (role) filter.role = new RegExp(role, 'i');
        if (type) filter.type = type;
        if (difficulty) filter.difficulty = difficulty;
        if (search) {
            filter.$or = [
                { question: new RegExp(search, 'i') },
                { company: new RegExp(search, 'i') },
                { description: new RegExp(search, 'i') }
            ];
        }

        const questions = await PlacementQuestion.find(filter)
            .populate("postedBy", "name avatar username")
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, data: questions });
    } catch (error) {
        console.error("Error in getQuestions:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const upvoteQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const question = await PlacementQuestion.findById(id);
        if (!question) return res.status(404).json({ success: false, message: "Question not found" });

        const hasUpvoted = question.upvotes.includes(req.user.id);
        if (hasUpvoted) {
            question.upvotes = question.upvotes.filter(uid => uid.toString() !== req.user.id);
        } else {
            question.upvotes.push(req.user.id);
        }

        await question.save();
        res.status(200).json({ success: true, upvotes: question.upvotes.length, hasUpvoted: !hasUpvoted });
    } catch (error) {
        console.error("Error in upvoteQuestion:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const addComment = async (req, res) => {
    try {
        const { id } = req.params;
        const { text } = req.body;
        if (!text) return res.status(400).json({ success: false, message: "Comment text is required" });

        const question = await PlacementQuestion.findById(id);
        if (!question) return res.status(404).json({ success: false, message: "Question not found" });

        question.comments.push({ user: req.user.id, text });
        await question.save();

        const updated = await PlacementQuestion.findById(id).populate("comments.user", "name avatar");
        res.status(200).json({ success: true, comments: updated.comments });
    } catch (error) {
        console.error("Error in addComment:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getTrending = async (req, res) => {
    try {
        // Simple trending logic: count upvotes and comments
        const trending = await PlacementQuestion.aggregate([
            {
                $addFields: {
                    score: { $add: [{ $size: "$upvotes" }, { $size: "$comments" }] }
                }
            },
            { $sort: { score: -1, createdAt: -1 } },
            { $limit: 10 }
        ]);

        // Aggregate doesn't auto-populate, so we need to do it manually or use another query
        const populated = await PlacementQuestion.populate(trending, { path: "postedBy", select: "name avatar username" });
        res.status(200).json({ success: true, data: populated });
    } catch (error) {
        console.error("Error in getTrending:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const toggleSave = async (req, res) => {
    try {
        const { id } = req.params;
        const question = await PlacementQuestion.findById(id);
        if (!question) return res.status(404).json({ success: false, message: "Question not found" });

        const isSaved = question.savedBy.includes(req.user.id);
        if (isSaved) {
            question.savedBy = question.savedBy.filter(uid => uid.toString() !== req.user.id);
        } else {
            question.savedBy.push(req.user.id);
        }

        await question.save();
        res.status(200).json({ success: true, isSaved: !isSaved });
    } catch (error) {
        console.error("Error in toggleSave:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
