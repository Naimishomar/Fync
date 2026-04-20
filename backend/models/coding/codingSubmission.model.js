import mongoose from 'mongoose';

const codingSubmissionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  problem: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', required: true },
  contest: { type: mongoose.Schema.Types.ObjectId, ref: 'Contest' }, // Optional, if for a contest
  code: { type: String, required: true },
  language: { type: String, required: true },
  languageId: { type: Number, required: true }, // Judge0 language ID
  status: { 
    type: String, 
    enum: [
      'Pending', 'Accepted', 'Wrong Answer', 'Time Limit Exceeded', 
      'Memory Limit Exceeded', 'Runtime Error', 'Compilation Error',
      'Internal Error', 'Internal Timeout', 'Exec Format Error'
    ], 
    default: 'Pending' 
  },
  judge0Token: { type: String }, // For polling results
  executionTime: { type: Number }, // ms
  memoryUsage: { type: Number }, // KB
  passedCount: { type: Number, default: 0 },
  totalCount: { type: Number, default: 0 },
  errorOutput: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const CodingSubmission = mongoose.model('CodingSubmission', codingSubmissionSchema);
export default CodingSubmission;
