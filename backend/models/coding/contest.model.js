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
    // ICPC-style tiebreak: minutes from contest start to each accepted solve,
    // plus a fixed cost per wrong attempt on a problem that was later solved.
    // Score alone cannot rank a weekly contest where most people solve the same
    // set — speed is the whole answer to "who solved it first".
    penalty: { type: Number, default: 0 },
    solved: [{
      problem: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem' },
      at: Date,
      penalty: Number
    }],
    enteredAt: Date, // Track when user clicked "Start"
    finishTime: Date
  }],
  // Set on contests the weekly scheduler generated, so it can tell whether this
  // week's contest already exists without matching on the title.
  weeklyKey: { type: String, index: true, sparse: true },
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
