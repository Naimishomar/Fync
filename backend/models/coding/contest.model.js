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
    enteredAt: Date, // Track when user clicked "Start"
    finishTime: Date
  }],
  status: { type: String, enum: ['Upcoming', 'Ongoing', 'Completed'], default: 'Upcoming' },
  prizePool: { type: String },
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Organiser/Host
  visibility: { type: String, enum: ['Public', 'Private'], default: 'Public' },
  inviteCode: { type: String }, // For private contests
  penaltyPerWrongSubmission: { type: Number, default: 5 }, // in minutes
  createdAt: { type: Date, default: Date.now }
});

const Contest = mongoose.model('Contest', contestSchema);
export default Contest;
