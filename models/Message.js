const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

// Auto-delete messages older than 20 days (20 * 24 * 60 * 60 seconds)
messageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1728000 });

module.exports = mongoose.model('Message', messageSchema);
