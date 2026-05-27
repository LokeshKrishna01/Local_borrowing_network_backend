const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  isGroup: {
    type: Boolean,
    default: false,
  },
  groupName: {
    type: String,
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
  },
}, { timestamps: true });

module.exports = mongoose.model('Conversation', conversationSchema);
