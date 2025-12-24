import express from 'express';
import Post from '../models/post.model.js';
import Comment from '../models/comment.model.js';
import User from '../models/user.model.js';

export const createPost = async(req,res)=>{
    try {
        const { description } = req.body;
        if(!description){
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        else{
            const user = await User.findById(req.user.id);
            if(!user){
                return res.status(400).json({ success: false, message: 'User not found' });
            }
            let image = [];
            if (req.files && req.files.length > 0) {
                image = req.files.map(file => file.path);
            }
            const post = await Post.create({
                description,
                image,
                user: req.user.id,
                college: req.user.college,
                likes: 0,
                liked_by: [],
                comments: []
            })
            return res.status(200).json({ success: true, message: 'Post created successfully', post });
        }
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const getPosts = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found, please login" });
        }
        const posts = await Post.find({ user: req.user.id })
        .populate("user", "name avatar username college")
        .populate({
            path: "comments",
            populate: { path: "user", select: "name avatar username" }
        })
        .sort({ createdAt: -1 });
        return res.status(200).json({ success: true, message: "Posts fetched successfully", posts });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const updatePost = async(req,res)=>{
    try {
        const { description } = req.body;
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found" });
        }
        if (post.user.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        else{
            let image = [];
            if (req.files && req.files.length > 0) {
                image = req.files.map(file => file.path);
            }
            const updatedPost = await Post.findByIdAndUpdate(
                req.params.id,
                {
                    $set: {
                        ...(description && { description }),
                        ...(image.length > 0 && { image }),
                    },
                },
                { new: true, runValidators: true }
            ).populate("user");
            return res.status(200).json({ success: true, message: "Post updated successfully", post: updatedPost });
        }
    } catch (error) {
       console.log("Internal server error", error);
       return res.status(500).json({ success: false, message: "Internal server error" });  
    }
}

export const deletePost = async(req,res)=>{
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found" });
        }
        if (post.user.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        else{
            const deletedPost = await Post.findByIdAndDelete(req.params.id);
            return res.status(200).json({ success: true, message: "Post deleted successfully", post: deletedPost });
        }
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const likePost = async (req, res) => {
  try {
    const userId = req.user.id;
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }
    const isLiked = post.liked_by.includes(userId);
    let updatedPost;
    if (isLiked) {
      updatedPost = await Post.findByIdAndUpdate(
        req.params.id,
        {
          $inc: { likes: -1 },
          $pull: { liked_by: userId }
        },
        { new: true }
      );
      return res.status(200).json({success: true, message: "Post unliked successfully", post: updatedPost});
    } else {
      updatedPost = await Post.findByIdAndUpdate(
        req.params.id,
        {
          $inc: { likes: 1 },
          $addToSet: { liked_by: userId }
        },
        { new: true }
      );
      return res.status(200).json({ success: true, message: "Post liked successfully",post: updatedPost});
    }
  } catch (error) {
    console.log("Internal server error", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const addComment = async(req,res)=>{
    try {
        const { text } = req.body;
        if(!text){
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        else{
            const user = await User.findById(req.user.id);
            if(!user){
                return res.status(400).json({ success: false, message: 'User not found' });
            }
            const post = await Post.findById(req.params.id);
            if(!post){
                return res.status(404).json({ success: false, message: 'Post not found' });
            }
            const comment = await Comment.create({
                text,
                commentor: req.user.id,
                post: req.params.id,
                postType: "Post"
            })
            const commenterDetails = await Comment.findById(comment._id).populate("commentor", "name avatar username");
            return res.status(200).json({ success: true, message: 'Comment created successfully', comment, commenterDetails });
        }
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const getComments = async(req,res)=>{
    try {
        const post = await Post.find({post: req.params.id, postType: "Post"})
        if(!post){
            return res.status(404).json({ success: false, message: 'Post not found' });
        }
        const comments = await Comment.find({ post: req.params.id })
        .populate("commentor", "name avatar username");
        return res.status(200).json({ success: true, message: 'Comments fetched successfully', comments });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const deleteComment = async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id);
        if (!comment) {
            return res.status(404).json({ success: false, message: 'Comment not found' });
        }
        if (comment.commentor.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        await Post.findByIdAndUpdate(comment.post, {
            $pull: { comments: comment._id }
        });
        const deletedComment = await Comment.findByIdAndDelete(req.params.id);
        return res.status(200).json({
            success: true,
            message: "Comment deleted successfully",
            deletedComment
        });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};


export const updateComment = async (req, res) => {
    try {
        const { text } = req.body;
        const comment = await Comment.findById(req.params.id);
        if (!comment) {
            return res.status(404).json({ success: false, message: 'Comment not found' });
        }
        if (comment.commentor.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        else{
            const updatedComment = await Comment.findByIdAndUpdate(
                req.params.id,
                {
                    $set: {
                        ...(text && { text }),
                    },
                },
                { new: true, runValidators: true }
            ).populate("commentor");
            return res.status(200).json({ success: true, message: 'Comment updated successfully', comment: updatedComment });
        }
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getFeed = async (req, res) => {
    try {
        const posts = await Post.find({ college: req.user.college })
        .populate("user", "name username avatar")
        .populate({
            path: "comments",
            populate: {
                path: "commentor",
                select: "name avatar username"
            }
        }).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, message: "Feed fetched successfully", posts});
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getFollowingPosts = async (req, res) => {
  try {
    const loggedInUserId = req.user.id;
    const user = await User.findById(loggedInUserId).select("following");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ user: { $in: followingList } })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("user", "name username avatar");
    res.status(200).json({ success: true, messgae: "Posts fetched successfully", posts });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};