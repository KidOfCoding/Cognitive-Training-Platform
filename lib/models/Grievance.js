import mongoose from 'mongoose';

const grievanceSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
  },
  userId: {
    type: String,
    default: '',
  },
  category: {
    type: String,
    required: true,
    enum: ['refund_irrelevant', 'bug_issue', 'suggestion'],
    default: 'refund_irrelevant',
  },
  subject: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  photoUrl: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['pending', 'under_review', 'resolved', 'refunded', 'rejected'],
    default: 'pending',
  },
  adminNotes: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.models.Grievance || mongoose.model('Grievance', grievanceSchema);
