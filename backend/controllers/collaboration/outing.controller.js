import express from 'express';
import Outing from '../../models/collaboration/outing.model.js';
// import cron from 'node-cron';

// cron.schedule('* * * * *', async () => {
//   const now = new Date();
//   try {
//     const result = await Outing.deleteMany({ outingDate: { $lte: now } });
//     console.log(`Deleted ${result.deletedCount} past outings`);
//   } catch (err) {
//     console.error(err);
//   }
// });


export const addOuting = async (req, res) => {
  try {
    const { destination, date, time } = req.body;
    if (!destination || !date || !time) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    const outingDate = new Date(date);
    const [hours, minutes] = time.split(":").map(Number);
    outingDate.setHours(hours, minutes);

    const startOfDay = new Date(date);
    startOfDay.setHours(0,0,0,0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23,59,59,999);

    const existingOuting = await Outing.findOne({
      admin: req.user.id,
      outingDate: { $gte: startOfDay, $lte: endOfDay }
    });

    if (existingOuting) {
      return res.status(400).json({
        success: false,
        message: 'You already have an outing scheduled on this date'
      });
    }

    const newOuting = await Outing.create({
      destination,
      date,
      time,
      outingDate,
      admin: req.user.id,
      college: req.user.college
    });

    return res.status(200).json({
      success: true,
      message: 'Outing created successfully',
      outing: newOuting
    });
  } catch (error) {
    console.error("Internal server error", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getAllOutings = async (req, res) => {
  try {
    const outings = await Outing.find({ college: req.user.college });
    if (!outings) {
      return res.status(404).json({ success: false, message: 'Outings not found' });
    }
    return res.status(200).json({ success: true, message: 'Outings fetched successfully', outings });
  } catch (error) {
    console.error("Internal server error", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getYourOuting = async (req, res) => {
  try {
    const outings = await Outing.find({ admin: req.user.id });
    if (!outings) {
      return res.status(404).json({ success: false, message: 'Outings not found' });
    }
    return res.status(200).json({ success: true, message: 'Outings fetched successfully', outings });
  } catch (error) {
    console.error("Internal server error", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const deleteOuting = async (req, res) => {
  try {
    const outing = await Outing.findById(req.params.id);
    if (!outing) {
      return res.status(404).json({ success: false, message: 'Outing not found' });
    }
    if (outing.admin.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const deletedOuting = await Outing.findByIdAndDelete(req.params.id);
    return res.status(200).json({ success: true, message: 'Outing deleted successfully', outing: deletedOuting });
  } catch (error) {
    console.error("Internal server error", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const joinOuting = async(req,res)=>{
    const {outing_id} = req.params;
    if(!outing_id){
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    const outing = await Outing.findById(outing_id);
    if(!outing){
        return res.status(404).json({ success: false, message: 'Outing not found' });
    }
    if (outing.users.some(u => u.toString() === req.user.id)) {
        return res.status(400).json({ success: false, message: 'You are already in this gaming' });
    }
    else{
        const updatedOuting = await Outing.findByIdAndUpdate(outing_id, {
            $push: {
                users: req.user.id
            }
        }, { new: true });
        return res.status(200).json({ success: true, message: 'You joined the outing successfully', outing: updatedOuting });
    }
}