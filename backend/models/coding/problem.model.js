import mongoose from 'mongoose';

const problemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' },
  category: { type: String, default: 'General' },
  tags: [String],
  testCases: [{
    input: String,
    expectedOutput: String,
    isHidden: { type: Boolean, default: false }
  }],
  starterCode: {
    javascript: String,
    python: String,
    cpp: String,
    java: String
  },
  constraints: [String],
  timeLimit: { type: Number, default: 1000 }, // ms
  memoryLimit: { type: Number, default: 256 }, // MB
  // Where an imported problem came from. sourceUrl is the dedupe key for
  // re-imports and the attribution link shown to solvers.
  source: { type: String, enum: ['manual', 'leetcode', 'codeforces', 'code_contests'], default: 'manual' },
  sourceUrl: { type: String },
  points: { type: Number, default: 100 },
  createdAt: { type: Date, default: Date.now }
});

const Problem = mongoose.model('Problem', problemSchema);
export default Problem;
