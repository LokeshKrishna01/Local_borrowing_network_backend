const express = require('express');
const { protect } = require('../middleware/auth');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
} = require('../controllers/notificationController');

const router = express.Router();

router.use(protect); // All notification routes are protected

router.get('/', getNotifications);
router.put('/read-all', markAllAsRead);
router.put('/:id/read', markAsRead);

module.exports = router;
