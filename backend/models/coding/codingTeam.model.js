import mongoose from 'mongoose';

const codingTeamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  leader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  contest: { type: mongoose.Schema.Types.ObjectId, ref: 'Contest' },
  // Short code a partner types to join. Unique so two teams can never share
  // one, sparse so pre-existing teams without a code do not collide on null.
  inviteCode: { type: String, unique: true, sparse: true, uppercase: true },
  submissions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CodingSubmission' }],
  score: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

// Team size is enforced in the controller: 2 for the group challenge.

const CodingTeam = mongoose.model('CodingTeam', codingTeamSchema);
export default CodingTeam;
