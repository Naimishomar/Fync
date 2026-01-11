import mongoose from "mongoose";

const roomSchema = new mongoose.Schema({
  roomId: { type: String, unique: true, required: true },
  host: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  domain: String,
  maxMembers: Number,
  duration: Number,
  startTime: Date,
  questions: [
    {
      question: String,
      options: [String],
      correctAnswer: Number,
    },
  ],
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  expireAt: { type: Date, default: undefined },
});
roomSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

const Room = mongoose.model("Room", roomSchema);
export default Room;