const express = require('express');
const { protect } = require('../middleware/auth');
const {
  getConversations,
  getMessages,
  findOrCreateConversation,
  findOrCreateNeighborhoodChat,
} = require('../controllers/chatController');

const router = express.Router();

router.use(protect);

router.get('/conversations', getConversations);
router.get('/messages/:conversationId', getMessages);
router.post('/conversation', findOrCreateConversation);
router.post('/neighborhood', findOrCreateNeighborhoodChat);

module.exports = router;
