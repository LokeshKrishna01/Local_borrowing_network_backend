const User = require('../models/User');
const Item = require('../models/Item');
const Transaction = require('../models/Transaction');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const cloudinary = require('../config/cloudinary');

/**
 * Perform cascading delete of a user and all related data
 * @param {string} userId - The ID of the user to delete
 */
const deleteUserAndData = async (userId) => {
  console.log(`[deleteUserAndData] Starting cascading delete for user: ${userId}`);

  // 1. Clean up Cloudinary images for items owned by this user
  const userItems = await Item.find({ owner: userId });
  for (const item of userItems) {
    if (item.imagePublicId) {
      try {
        await cloudinary.uploader.destroy(item.imagePublicId);
        console.log(`[deleteUserAndData] Cloudinary image destroyed for item: ${item._id}`);
      } catch (err) {
        console.error(`[deleteUserAndData] Failed to delete Cloudinary image for item ${item._id}:`, err.message);
      }
    }
  }

  // 2. Delete all items listed by the user
  const deletedItemsResult = await Item.deleteMany({ owner: userId });
  console.log(`[deleteUserAndData] Deleted ${deletedItemsResult.deletedCount} items.`);

  // 3. Delete all transactions involving this user (either as borrower or lender)
  const deletedTxnsResult = await Transaction.deleteMany({
    $or: [{ borrower: userId }, { lender: userId }]
  });
  console.log(`[deleteUserAndData] Deleted ${deletedTxnsResult.deletedCount} transactions.`);

  // 4. Preserve conversations and messages as requested (others will see as "Deleted User")
  console.log(`[deleteUserAndData] Preserving conversations and messages for other participants.`);

  // 5. Delete all notifications sent to or from this user
  const deletedNotificationsResult = await Notification.deleteMany({
    $or: [{ recipient: userId }, { sender: userId }]
  });
  console.log(`[deleteUserAndData] Deleted ${deletedNotificationsResult.deletedCount} notifications.`);

  // 6. Finally, delete the User profile itself
  const userDeletionResult = await User.deleteOne({ _id: userId });
  console.log(`[deleteUserAndData] User deleted: ${userDeletionResult.deletedCount}`);

  return {
    success: true,
    deletedItemsCount: deletedItemsResult.deletedCount,
    deletedTxnsCount: deletedTxnsResult.deletedCount,
    deletedConversationsCount: 0,
    deletedMessagesCount: 0,
    deletedNotificationsCount: deletedNotificationsResult.deletedCount,
  };
};

module.exports = { deleteUserAndData };
