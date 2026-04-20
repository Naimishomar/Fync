import mongoose from 'mongoose';

const codingTeamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  leader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  contest: { type: mongoose.Schema.Types.ObjectId, ref: 'Contest' },
  submissions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CodingSubmission' }],
  score: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

// Max size check (4) can be handled in controller logic

const CodingTeam = mongoose.model('CodingTeam', codingTeamSchema);
export default CodingTeam;
