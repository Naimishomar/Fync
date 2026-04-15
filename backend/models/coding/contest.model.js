import mongoose from 'mongoose';

const contestSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  problems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Problem' }],
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  participants: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    score: { type: Number, default: 0 },
    finishTime: Date
  }],
  status: { type: String, enum: ['Upcoming', 'Ongoing', 'Completed'], default: 'Upcoming' },
  prizePool: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const Contest = mongoose.model('Contest', contestSchema);
export default Contest;
