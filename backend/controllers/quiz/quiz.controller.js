import Room from "../../models/quiz/room.model.js";
import Submission from "../../models/quiz/submission.model.js";
import User from "../../models/user.model.js";
import { nanoid } from "nanoid";

export const createRoom = async (req, res) => {
  try {
    const { domain, maxMembers, startTime, duration, questions } = req.body;

    const startObj = new Date(startTime);
    if (Number.isNaN(startObj.getTime())) {
      return res.status(400).json({ success: false, message: "A valid startTime is required" });
    }
    if (!Number.isFinite(Number(duration)) || Number(duration) <= 0) {
      return res.status(400).json({ success: false, message: "A positive duration (minutes) is required" });
    }

    const roomId = nanoid(6).toUpperCase();
    const expireTime = new Date(startObj.getTime() + (duration * 60000) + 3600000); 

    await Room.create({
      roomId,
      host: req.user.id,
      domain,
      maxMembers,
      startTime: startObj,
      duration,
      questions,
      expireAt: expireTime
    });

    res.status(201).json({ roomId });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getArenaStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select("oneVsOnePoints");
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const points = user.oneVsOnePoints || 0;
    const rank = await User.countDocuments({ oneVsOnePoints: { $gt: points } }) + 1;

    res.status(200).json({ points, rank });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getRoomById = async (req, res) => {
  try {
    let { roomId } = req.params;
    roomId = roomId.toUpperCase();
    console.log(`🔍 Searching for Room: '${roomId}'`);
    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ message: "Room not found or expired" });
    }
    res.status(200).json({
      roomId: room.roomId,
      startTime: room.startTime,
      duration: room.duration,
      domain: room.domain
    });
  } catch (error) {
    console.error("Get Room Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getLeaderboard = async (req, res) => {
  try {
    const { roomId } = req.params;
    const leaderboard = await Submission.find({ roomId })
      .populate("user", "username name profileImage")
      .sort({ score: -1, submittedAt: 1 })
      .limit(50);

    res.status(200).json(leaderboard);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getTopGladiators = async (req, res) => {
  try {
    const topUsers = await User.find({ oneVsOnePoints: { $gt: 0 } })
      .select("name username avatar oneVsOnePoints")
      .sort({ oneVsOnePoints: -1 })
      .limit(10);
    res.status(200).json(topUsers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};