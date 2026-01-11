import express from "express";
import FundingProject from "../models/funding.model.js";
import User from "../models/user.model.js";

export const createFundingPost = async (req, res) => {
  try {
    const { title, description, deployed_url, github_url } = req.body;
    if (!title || !description || !deployed_url) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    let image = [];
    let video = "";
    if (req.files?.image) {
      image = req.files.image.map(f => f.path);
    }
    if (req.files?.video?.[0]) {
    video = req.files.video[0].path;
    }
    if (image.length === 0 && !video) {
      return res.status(400).json({ message: "At least one image or video required" });
    }
    const project = await FundingProject.create({
      user: req.user.id,
      title,
      description,
      image,
      video,
      deployed_url,
      github_url,
      likes: 0,
      liked_by: [],
      comments: [],
    });
    res.status(201).json({ success: true, message: "Funding project created successfully", project});
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};


export const getAllProjects = async(req,res)=>{
    try {
        const { page } = req.query;
        const limit = 5;
        const skip = (page - 1) * limit;
        const projects = await FundingProject.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("user", "name username avatar");
        if(!projects){
            return res.status(404).json({ success: false, message: 'Projects not found' });
        }
        return res.status(200).json({ success: true, message: 'Projects fetched successfully', projects });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const getYourProjects = async(req,res)=>{
    try {
        const projects = await FundingProject.find({ user: req.user.id });
        if(!projects){
            return res.status(404).json({ success: false, message: "Projects not found" });
        }
        return res.status(200).json({ success: true, message: "Projects fetched successfully", projects });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });    
    }
}

export const updateProject = async(req,res)=>{
    try {
        const project = await FundingProject.findById(req.params.id);
        if(!project){
            return res.status(404).json({ success: false, message: "Project not found" });
        }
        if(project.user.toString() !== req.user.id){
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        else{
            let image = [];
            let video = "";
            if (req.files && Array.isArray(req.files)) {
                image = req.files.map(file => file.path);
            }
            if (req.file) {
                video = req.file.path;
            }
            const updatedProject = await FundingProject.findByIdAndUpdate(
                req.params.id,
                {
                    $set: {
                        ...(req.body.title && { title: req.body.title }),
                        ...(req.body.description && { description: req.body.description }),
                        ...(image.length > 0 && { image }),
                        ...(video && { video }),
                        ...(req.body.deployed_url && { deployed_url: req.body.deployed_url }),
                        ...(req.body.github_url && { github_url: req.body.github_url }),
                    },
                },
                { new: true, runValidators: true }
            ).populate("user");
            return res.status(200).json({ success: true, message: "Project updated successfully", project: updatedProject });
        }
    } catch (error) {
       console.log("Internal server error", error);
       return res.status(500).json({ success: false, message: "Internal server error" });  
    }
}

export const likeAndUnlikeProject = async(req,res)=>{
    try {
        const project = await FundingProject.findById(req.params.id);
        if(!project){
            return res.status(404).json({ success: false, message: "Project not found" });
        }
        const isLiked = project.liked_by.includes(req.user.id);
        let updatedProject;
        if(isLiked){
            updatedProject = await FundingProject.findByIdAndUpdate(
                req.params.id,
                {
                    $inc: { likes: -1 },
                    $pull: { liked_by: req.user.id }
                },
                { new: true }
            );
            return res.status(200).json({ success: true, message: "Project unliked successfully", project: updatedProject });
        }
        else{
            updatedProject = await FundingProject.findByIdAndUpdate(
                req.params.id,
                {
                    $inc: { likes: 1 },
                    $addToSet: { liked_by: req.user.id }
                },
                { new: true }
            );
            return res.status(200).json({ success: true, message: "Project liked successfully", project: updatedProject });
        }
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const addComment = async(req,res)=>{
    try {
        const { text } = req.body;
        if(!text){
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }
        const project = await FundingProject.findById(req.params.id);
        if(!project){
            return res.status(404).json({ success: false, message: "Project not found" });
        }
        const comment = await Comment.create({
            text,
            commentor: req.user.id,
            post: req.params.id,
            postType: "FundingProject"
        })
        const commenterDetails = await Comment.findById(comment._id).populate("commentor", "name avatar username");
        return res.status(200).json({ success: true, message: "Comment created successfully", comment, commenterDetails });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" }); 
    }
}

export const getAllComments = async (req, res) => {
  try {
    const comments = await Comment.find({ post: req.params.id, postType: "FundingProject" })
      .sort({ createdAt: -1 })
      .populate("commentor", "name avatar username");
    if (!comments) {
      return res.status(404).json({ success: false, message: "No comments" });
    }
    const totalComments = comments.length;
    return res.status(200).json({ success: true, message: "Comments fetched successfully", comments, totalComments });
  } catch (error) {
    console.log("Internal server error", error);
    return res.status(500).json({success: false,message: "Internal server error",});
  }
};

export const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.find({post:req.params.id, postType: "FundingProject"});
    if (!comment) {
      return res.status(404).json({ success: false, message: "Comment not found" });
    }
    if (comment.commentor.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }
    await Comment.findOneAndDelete({post:req.params.id});
    return res.status(200).json({ success: true, message: "Comment deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};