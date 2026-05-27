const socketio = require('socket.io');
const Message = require('./models/Message');
const Conversation = require('./models/Conversation');
const { createNotification } = require('./utils/notificationService');

const initSocket = (server) => {
  const io = socketio(server, {
    cors: {
      origin: "*", // Allow all for debugging, or use process.env.CLIENT_URL
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('New socket connection:', socket.id);

    // Join a specific room (conversation ID)
    socket.on('join_room', (roomId) => {
      socket.join(roomId);
      console.log(`User joined room: ${roomId}`);
    });

    // Handle sending a message
    socket.on('send_message', async (data) => {
      const { conversationId, senderId, text } = data;
      console.log('Message received on server:', text);
      
      try {
        const message = await Message.create({
          conversation: conversationId,
          sender: senderId,
          text,
        });

        // Update last message in conversation
        const conversation = await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: message._id,
        }, { new: true }).populate('participants', 'name');

        // Emit message to everyone in the room
        io.to(conversationId).emit('receive_message', message);

        // Send notifications to other participants
        const otherParticipants = conversation.participants.filter(p => p._id.toString() !== senderId);
        
        for (const recipient of otherParticipants) {
          await createNotification({
            recipient: recipient._id,
            sender: senderId,
            type: 'message',
            message: `New message from ${conversation.isGroup ? conversation.groupName : 'a neighbor'}`,
            link: '/chat',
          });
        }
      } catch (error) {
        console.error('Socket error sending message:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
    });
  });

  return io;
};

module.exports = initSocket;
