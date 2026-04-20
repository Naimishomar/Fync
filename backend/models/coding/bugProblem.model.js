import mongoose from 'mongoose';

const bugProblemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  buggyCode: { 
    type: String, 
    required: true 
  }, // The code provided to users to "fix"
  starterCode: {
    javascript: String,
    python: String,
    cpp: String,
    java: String
  },
  difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' },
  language: { type: String, required: true },
  testCases: [{
    input: String,
    expectedOutput: String,
    isHidden: { type: Boolean, default: false }
  }],
  points: { type: Number, default: 50 },
  createdAt: { type: Date, default: Date.now }
});

const BugProblem = mongoose.model('BugProblem', bugProblemSchema);
export default BugProblem;
