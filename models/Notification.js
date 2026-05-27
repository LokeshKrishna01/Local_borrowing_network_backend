const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  type: {
    type: String,
    enum: ['request', 'approval', 'rejection', 'return', 'admin_alert', 'message'],
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  link: {
    type: String, // Where to redirect when clicked
  },
  isRead: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

// Auto-delete notifications older than 20 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1728000 });

module.exports = mongoose.model('Notification', notificationSchema);
