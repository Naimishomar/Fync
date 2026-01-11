import Room from "../../models/quiz/room.model.js";
import Submission from "../../models/quiz/submission.model.js";
import { nanoid } from "nanoid";

export const createRoom = async (req, res) => {
  try {
    const { domain, maxMembers, startTime, duration, questions } = req.body;
    const roomId = nanoid(6).toUpperCase();
    const startObj = new Date(startTime);
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