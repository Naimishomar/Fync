import express from 'express';
import Gaming from '../../models/collaboration/gaming.model.js';
import mongoose from 'mongoose';

export const addGames = async (req, res) => {
  try {
    const { game_name, date, time, venue, team_size } = req.body;
    if (!game_name || !date || !time || !team_size || !venue) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    const gamingDate = new Date(date);
    const [hours, minutes] = time.split(":").map(Number);
    gamingDate.setHours(hours, minutes, 0, 0);

    const startOfDay = new Date(date);
    startOfDay.setHours(0,0,0,0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23,59,59,999);

    const existingGames = await Gaming.findOne({
      admin: req.user.id,
      gamingDate: { $gte: startOfDay, $lte: endOfDay }
    });

    if (existingGames) {
      return res.status(400).json({
        success: false,
        message: 'You already have an outing scheduled on this date'
      });
    }

    const newGames = await Gaming.create({
      game_name,
      date,
      time,
      gamingDate,
      venue,
      admin: req.user.id,
      team_size,
      college: req.user.college
    });

    return res.status(200).json({
      success: true,
      message: 'Outing created successfully',
      outing: newGames
    });
  } catch (error) {
    console.error("Internal server error", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getAllGames = async (req, res) => {
  try {
    const gamings = await Gaming.find({ college: req.user.college })
    .populate("admin", "name username avatar")
    .populate("users", "name username avatar");
    if (!gamings) {
      return res.status(404).json({ success: false, message: 'Gamings not found' });
    }
    return res.status(200).json({ success: true, message: 'Gamings fetched successfully', gamings });
  } catch (error) {
    console.error("Internal server error", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getYourGames = async (req, res) => {
  try {
    const gamings = await Gaming.find({ admin: req.user.id });
    if (!gamings) {
      return res.status(404).json({ success: false, message: 'Gamings not found' });
    }
    return res.status(200).json({ success: true, message: 'Gamings fetched successfully', gamings });
  } catch (error) {
    console.error("Internal server error", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const deleteGames = async (req, res) => {
  try {
    const gaming = await Gaming.findById(req.params.id);
    if (!gaming) {
      return res.status(404).json({ success: false, message: 'Gaming not found' });
    }
    if (gaming.admin.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const deletedGaming = await Gaming.findByIdAndDelete(req.params.id);
    return res.status(200).json({ success: true, message: 'Gaming deleted successfully', gaming: deletedGaming });
  } catch (error) {
    console.error("Internal server error", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const joinGames = async(req,res)=>{
    try {
        const gaming_id = req.params.id;
        const userId = req.user._id || req.user.id; // Safely get ID

        const gaming = await Gaming.findById(gaming_id);
        if(!gaming) return res.status(404).json({ success: false, message: 'Gaming not found' });
        
        if (gaming.users.length >= gaming.team_size) {
            return res.status(400).json({ success: false, message: 'Team size is full' });
        }
        
        if (gaming.users.some(u => u.toString() === userId.toString())) {
            return res.status(400).json({ success: false, message: 'You are already in this game' });
        }

        const updatedGaming = await Gaming.findByIdAndUpdate(
            gaming_id, 
            { $push: { users: userId } }, 
            { new: true }
        ).populate("users", "name username avatar"); // Ensure we return populated data!

        return res.status(200).json({ success: true, message: 'Joined successfully', gaming: updatedGaming });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const leaveGames = async (req, res) => {
  try {
    const gaming_id = req.params.id;
    const userId = req.user._id || req.user.id;

    const gaming = await Gaming.findById(gaming_id);
    if (!gaming) return res.status(404).json({success: false, message: "Gaming not found"});

    if (!gaming.users.some(u => u.toString() === userId.toString())) {
      return res.status(400).json({ success: false, message: "You are not in this game"});
    }

    const updated = await Gaming.findByIdAndUpdate(
      gaming_id,
      { $pull: { users: new mongoose.Types.ObjectId(req.user.id) } },
      { new: true }
    ).populate("users", "name username avatar"); // Ensure we return populated data!

    return res.status(200).json({ success: true, message: "Left game successfully", gaming: updated});
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal server error"});
  }
};