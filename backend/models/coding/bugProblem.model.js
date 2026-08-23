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
  // The working version. Kept for the "show solution" reveal after a solve and
  // for regenerating the diff hint; never sent to the client before then.
  fixedCode: { type: String },
  difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' },
  language: { type: String, required: true },
  // Track students pick and progress through. Broader than `language`: a Node
  // and an Express bug are both JavaScript but sit in different tracks.
  domain: {
    type: String,
    enum: ['python', 'cpp', 'java', 'javascript', 'nodejs', 'express', 'react', 'mongodb', 'sql'],
    required: true,
    index: true,
  },
  // How many lines differ from the fix. Drives difficulty and gives the student
  // an honest "how big is this bug" signal without giving away where it is.
  buggyLines: { type: Number, default: 1 },
  source: { type: String, enum: ['manual', 'code_contests'], default: 'manual' },
  sourceUrl: { type: String },
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
