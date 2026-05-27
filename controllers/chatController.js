const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

// @desc    Get all conversations for user
// @route   GET /api/chat/conversations
// @access  Private
const getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: { $in: [req.user._id] }
    })
    .populate('participants', 'name email')
    .populate('lastMessage')
    .sort({ updatedAt: -1 });

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get messages for conversation
// @route   GET /api/chat/messages/:conversationId
// @access  Private
const getMessages = async (req, res) => {
  try {
    const messages = await Message.find({ conversation: req.params.conversationId })
      .populate('sender', 'name')
      .sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Find or create 1-on-1 conversation
// @route   POST /api/chat/conversation
// @access  Private
const findOrCreateConversation = async (req, res) => {
  const { recipientId } = req.body;

  try {
    // Look for existing 1-on-1 conversation
    let conversation = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [req.user._id, recipientId] }
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.user._id, recipientId],
        isGroup: false,
      });
    }

    await conversation.populate('participants', 'name email');
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Find or create the global neighborhood group chat
// @route   POST /api/chat/neighborhood
// @access  Private
const findOrCreateNeighborhoodChat = async (req, res) => {
  try {
    let conversation = await Conversation.findOne({ isGroup: true, groupName: 'Neighborhood Hub' });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.user._id], // Initial participant
        isGroup: true,
        groupName: 'Neighborhood Hub',
      });
    } else {
      // Add user to participants if not already there
      if (!conversation.participants.includes(req.user._id)) {
        conversation.participants.push(req.user._id);
        await conversation.save();
      }
    }

    await conversation.populate('participants', 'name email');
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getConversations,
  getMessages,
  findOrCreateConversation,
  findOrCreateNeighborhoodChat,
};
