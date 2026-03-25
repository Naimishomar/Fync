import Comment from "../../models/comment.model.js";
import FyncMedia from "../../models/fync media/fyncMedia.model.js";
import User from "../../models/user.model.js";
import { deleteFromCloudinary } from "../../utils/cloudinary.js";


export const createFyncMedia = async(req,res)=>{
    try {
        const {title, description, tags, duration} = req.body;
        if(!title || !description){
            return res.status(400).json({message: "Missing required fields", success: false});
        }

        const wordCount = description.trim().split(/\s+/).length;
        if(wordCount > 300){
            return res.status(400).json({message: "Description must be less than 300 words", success: false});
        }
        
        if(title.length > 100){
             return res.status(400).json({message: "Title must be less than 100 characters", success: false});
        }

        const thumbnail = req.files?.thumbnail?.path;
        const video = req.files?.video?.path;
        if(!thumbnail || !video){
            return res.status(400).json({message: "Missing required fields", success: false});
        }

        const adminUser = await User.findOne({ email: process.env.MEDIA_ADMIN_EMAIL });
        if (!adminUser || req.user.id.toString() !== adminUser._id.toString()) {
            return res.status(401).json({
                message: "Unauthorized user",
                success: false
            });
        }

        let processedTags = [];
        if (tags) {
            if (Array.isArray(tags)) {
                processedTags = tags;
            } else if (typeof tags === "string") {
                processedTags = tags
                .split(",")
                .map(tag => tag.trim().toLowerCase())
                .filter(tag => tag.length > 0);
            }
        }
        const fyncMedia = await FyncMedia.create({
            title,
            description,
            thumbnail,
            video_link: video,
            admin: adminUser._id,
            date: Date.now(),
            likes: 0,
            comment: [],
            tags: processedTags,
            duration: duration || "0:00",
        });
        return res.status(201).json({message: "Fync Media created successfully", success: true, data: fyncMedia});
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({message: "Internal Server Error", success: false});
    }
}

export const getFyncMedia = async(req,res)=>{
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const fyncMedia = await FyncMedia.find({})
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("admin", "name username email");
        if (fyncMedia.length === 0) {
            return res.status(200).json({
                message: "No Fync Media found",
                success: true,
                data: []
            });
        }
        return res.status(200).json({message: "Fync Media fetched successfully", success: true, data: fyncMedia});
    } catch (error) {
       return res.status(500).json({message: "Internal Server Error", success: false});
    }
}

export const getFyncMediaById = async(req,res)=>{
    try {
        const {id} = req.params;
        const fyncMedia = await FyncMedia.findById(id).populate("admin", "name username email");
        if(!fyncMedia){
            return res.status(404).json({message: "No Fync Media found", success: false});
        }
        return res.status(200).json({message: "Fync Media fetched successfully", success: true, data: fyncMedia});
    } catch (error) {
        return res.status(500).json({message: "Internal Server Error", success: false});
    }
}

export const updateMedia = async (req, res) => {
    try {
        const media = await FyncMedia.findById(req.params.id);
        if (!media) {
            return res.status(404).json({ success: false, message: "Media not found" });
        }
        if (media.admin.toString() !== req.user.id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        const { title, description, tags, duration } = req.body;
        
        if (title && title.length > 100) {
            return res.status(400).json({ success: false, message: "Title must be 100 characters or less." });
        }
        if (description) {
            const wordCount = description.trim().split(/\s+/).length;
            if (wordCount > 300) {
                return res.status(400).json({ success: false, message: "Description must be less than 300 words." });
            }
        }

        const thumbnail = req.files?.thumbnail?.path;
        const video = req.files?.video?.path;

        if (thumbnail && media.thumbnail) {
            await deleteFromCloudinary(media.thumbnail, "image");
        }
        if (video && media.video_link) {
            await deleteFromCloudinary(media.video_link, "video");
        }

        const updatedMedia = await FyncMedia.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    ...(title && { title }),
                    ...(description && { description }),
                    ...(thumbnail && { thumbnail }),
                    ...(video && { video_link: video }),
                    ...(tags && { tags: Array.isArray(tags) ? tags: tags.split(",").map(tag => tag.trim())}),
                    ...(duration && { duration }),
                },
            },
            { new: true, runValidators: true }
        ).populate("admin");
        return res.status(200).json({ success: true, message: "Media updated successfully", media: updatedMedia });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const deleteMedia = async (req, res) => {
    try {
        const media = await FyncMedia.findById(req.params.id);
        if (!media) {
            return res.status(404).json({ success: false, message: "Media not found" });
        }
        if (media.admin.toString() !== req.user.id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        if (media.video_link) {
            await deleteFromCloudinary(media.video_link, "video");
        }
        if (media.thumbnail) {
            await deleteFromCloudinary(media.thumbnail, "image");
        }
        await Comment.deleteMany({ post: req.params.id, postType: "FyncMedia" });
        await FyncMedia.findByIdAndDelete(req.params.id);
        return res.status(200).json({ success: true, message: "Media deleted successfully" });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const likeAndUnlikeMedia = async (req, res) => {
    try {
        const userId = req.user.id.toString();
        const media = await FyncMedia.findById(req.params.id);
        if (!media) return res.status(404).json({ success: false, message: "Media not found" });

        const isLiked = media.liked_by.some(id => id.toString() === userId);
        const isDisliked = media.disliked_by.some(id => id.toString() === userId);

        let updateQuery = {};

        if (isLiked) {
            updateQuery = { $pull: { liked_by: userId }, $inc: { likes: -1 } };
        } else {
            updateQuery = { $push: { liked_by: userId }, $inc: { likes: 1 } };
            if (isDisliked) {
                updateQuery.$pull = { disliked_by: userId };
                updateQuery.$inc = { ...updateQuery.$inc, dislikes: -1 };
            }
        }

        const updatedMedia = await FyncMedia.findByIdAndUpdate(req.params.id, updateQuery, { new: true });
        return res.status(200).json({ success: true, message: isLiked ? "Unliked successfully" : "Liked successfully", media: updatedMedia });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const dislikeAndUndislikeMedia = async (req, res) => {
    try {
        const userId = req.user.id.toString();
        const media = await FyncMedia.findById(req.params.id);
        if (!media) return res.status(404).json({ success: false, message: "Media not found" });

        const isLiked = media.liked_by.some(id => id.toString() === userId);
        const isDisliked = media.disliked_by.some(id => id.toString() === userId);

        let updateQuery = {};

        if (isDisliked) {
            updateQuery = { $pull: { disliked_by: userId }, $inc: { dislikes: -1 } };
        } else {
            updateQuery = { $push: { disliked_by: userId }, $inc: { dislikes: 1 } };
            if (isLiked) {
                updateQuery.$pull = { liked_by: userId };
                updateQuery.$inc = { ...updateQuery.$inc, likes: -1 };
            }
        }

        const updatedMedia = await FyncMedia.findByIdAndUpdate(req.params.id, updateQuery, { new: true });
        return res.status(200).json({ success: true, message: isDisliked ? "Undisliked successfully" : "Disliked successfully", media: updatedMedia });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const addMediaComment = async (req, res) => {
    try {
        const { text, parentComment, replyToUser } = req.body;
        const mediaId = req.params.id;
        const userId = req.user.id;

        if (!text) return res.status(400).json({ success: false, message: "Comment text is required" });

        const newComment = new Comment({
            text,
            commentor: userId,
            post: mediaId,
            postType: 'FyncMedia',
            parentComment: parentComment || null,
            replyToUser: replyToUser || null
        });

        await newComment.save();
        
        await FyncMedia.findByIdAndUpdate(mediaId, {
            $push: { comment: newComment._id }
        });

        return res.status(201).json({ success: true, message: "Comment added successfully", comment: newComment });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getMediaComments = async (req, res) => {
    try {
        const comments = await Comment.find({ post: req.params.id, postType: 'FyncMedia' })
            .populate('commentor', 'name username avatar')
            .populate({
                path: 'replyToUser',
                select: 'name username'
            })
            .sort({ createdAt: -1 });
            
        return res.status(200).json({ success: true, comments });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const deleteMediaComment = async (req, res) => {
    try {
        const commentId = req.params.id;
        const userId = req.user.id;

        const comment = await Comment.findById(commentId);
        if (!comment) return res.status(404).json({ success: false, message: "Comment not found" });

        // Check ownership
        if (comment.commentor.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized to delete this comment" });
        }

        // Pull reference from FyncMedia
        await FyncMedia.findByIdAndUpdate(comment.post, {
            $pull: { comment: commentId }
        });

        await Comment.findByIdAndDelete(commentId);

        // Also delete any nested replies to this comment
        await Comment.deleteMany({ parentComment: commentId });

        return res.status(200).json({ success: true, message: "Comment deleted successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};