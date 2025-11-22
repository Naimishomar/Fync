import express from 'express';
import Gaming from '../../models/collaboration/gaming.model.js';
import cron from 'node-cron';

cron.schedule('* * * * *', async () => {
  const now = new Date();
  try {
    const result = await Gaming.deleteMany({ gamingDate: { $lte: now } });
    console.log(`Deleted ${result.deletedCount} past gamings`);
  } catch (err) {
    console.error(err);
  }
});

export const addGames = async (req, res) => {
  try {
    const { game_name, date, time, venue, team_size } = req.body;
    if (!game_name || !date || !time || !team_size || !venue) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    const gamingDate = new Date(date);
    const [hours, minutes] = time.split(":").map(Number);
    gamingDate.setHours(hours, minutes);

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
      admin: req.user.id
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
    const gamings = await Gaming.find();
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
        const {gaming_id} = req.params;
        if(!gaming_id){
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        const gaming = await Gaming.findById(gaming_id);
        if(!gaming){
            return res.status(404).json({ success: false, message: 'Gaming not found' });
        }
        if (gaming.users.length >= gaming.team_size) {
            return res.status(400).json({ success: false, message: 'Team size is full' });
        }
        if (gaming.users.some(u => u.toString() === req.user.id)) {
            return res.status(400).json({ success: false, message: 'You are already in this gaming' });
        }
        else{
            const updatedGaming = await Gaming.findByIdAndUpdate(gaming_id, {
                $push: {
                    users: req.user.id
                }
            }, { new: true });
            return res.status(200).json({ success: true, message: 'You joined the gaming successfully', gaming: updatedGaming });
        }
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}