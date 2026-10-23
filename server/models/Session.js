const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  candidate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  problem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Problem',
    default: null,
  },
  status: {
    type: String,
    enum: ['waiting', 'active', 'completed'],
    default: 'waiting',
  },
  title: {
    type: String,
    default: 'Untitled Interview Session',
  },
  code: {
    type: String,
    default: '', // empty, not language-specific — avoids stale placeholder overwrites
  },

  endedAt: {
  type: Date,
  default: null,
},
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);