const Notification = require('../models/Notification');

/**
 * Create a new notification
 * @param {Object} data { recipient, sender, type, message, link }
 */
const createNotification = async (data) => {
  try {
    const notification = await Notification.create(data);
    return notification;
  } catch (error) {
    console.error('Notification Error:', error);
  }
};

module.exports = { createNotification };
