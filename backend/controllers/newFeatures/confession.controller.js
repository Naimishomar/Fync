import Confession from "../../models/newFeatures/confession.model.js";
import ConfessionReport from "../../models/newFeatures/confessionReport.model.js";
import Comment from "../../models/comment.model.js";

export const createConfession = async(req,res)=>{
    try {
        const { message } = req.body;
        if(!message){
            return res.status(400).json({message: "Please provide a message", success: false});
        }
        const confession = await Confession.create({
            senderId: req.user.id,
            collegeName: req.user.college,
            message,
            isBanned: false
        })
        return res.status(201).json({message: "Confession created successfully", success: true, confession});
    } catch (error) {
        console.log("Internal server error", error);
        res.status(500).json({
            message: "Internal server error",
            error: error.message
        });
    }
}

export const getConfession = async(req,res)=>{
    try {
        const confession = await Confession.find({ collegeName: req.user.college }).populate("senderId", "username");
        if(!confession){
            return res.status(404).json({message: "No confessions found", success: false});
        }
        return res.status(200).json({message: "Confessions found", success: true, confession});
    } catch (error) {
        console.log("Internal server error", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
}

export const deleteConfession = async(req,res)=>{
    try {
        const { confessionId } = req.params;
        const confession = await Confession.findById(confessionId);
        if(!confession){
            return res.status(404).json({message: "No confession found", success: false});
        }
        if(confession.senderId.toString() !== req.user.id.toString()){
            return res.status(403).json({message: "You are not authorized to delete this confession", success: false});
        }
        await Confession.findByIdAndDelete(confessionId);
        return res.status(200).json({message: "Confession deleted successfully", success: true});
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
}

export const likeAndUnlikeConfession = async (req, res) => {
    try {
        const { confessionId } = req.params;
        const userId = req.user.id;
        const confession = await Confession.findById(confessionId);
        if (!confession) {
            return res.status(404).json({success: false,message: "Confession not found"});
        }
        const isLiked = confession.likes.some(
            id => id.toString() === userId.toString()
        );
        if (isLiked) {
            confession.likes = confession.likes.filter(
                id => id.toString() !== userId.toString()
            );
        } else {
            confession.likes.push(userId);
        }
        await confession.save();
        return res.status(200).json({ success: true, message: isLiked ? "Confession unliked" : "Confession liked", likesCount: confession.likes.length});

    } catch (error) {
        console.error("Like/unlike error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

export const createConfessionComment = async(req,res)=>{
    try {
        const { text } = req.body;
        if(!text){
            return res.status(400).json({message: "Missing required fields", success: false});
        }
        const { confessionId } = req.params;
        const confession = await Confession.findById(confessionId);
        if(!confession){
            return res.status(404).json({message: "No confession found", success: false});
        }
        const comment = new Comment({
            text,
            commentor: req.user.id,
            post: confessionId,
            postType: "Confession",
            expiresAt: new Date(confession.createdAt.getTime() + 1000 * 60 * 60 * 24 * 7)
        })
        await comment.save();
        const commenterDetails = await Comment.findById(comment._id).populate("commentor", "name avatar username");
        return res.status(200).json({message: "Comment created successfully", success: true, comment, commenterDetails});
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
}

export const getConfessionComments = async(req,res)=>{
    try {
        const { confessionId } = req.params;
        const confession = await Confession.findById(confessionId);
        if(!confession){
            return res.status(404).json({message: "No confession found", success: false});
        }
        const comments = await Comment.find({ post: confessionId, postType: "Confession" })
        .populate("commentor", "name avatar username");
        return res.status(200).json({message: "Comments fetched successfully", success: true, comments, commentLength: comments.length});
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
}

export const reportConfession = async(req,res)=>{
    try {
        const { confessionId } = req.params;
        const confession = await Confession.findById(confessionId);
        if(!confession){
            return res.status(404).json({message: "No confession found", success: false});
        }
        if(confession.senderId.toString() === req.user.id.toString()){
            return res.status(403).json({message: "You are not authorized to report your confession", success: false});
        }
        const report = await ConfessionReport.create({
            confessionId: confessionId,
            reporterId: req.user.id
        })
        return res.status(201).json({message: "Report created successfully", success: true, report});
    } catch (error) {
        console.log("Internal server erro", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
}