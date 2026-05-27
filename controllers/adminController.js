const User = require('../models/User');
const Item = require('../models/Item');
const Transaction = require('../models/Transaction');
const { createNotification } = require('../utils/notificationService');
const { deleteUserAndData } = require('../utils/deleteUserHelper');

// @desc    Get all users (with optional status filter)
// @route   GET /api/admin/users
// @access  Admin
const getUsers = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { role: { $ne: 'admin' } };
    if (status) filter.status = status;

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Approve a user (set status to active)
// @route   PUT /api/admin/users/:id/approve
// @access  Admin
const approveUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(400).json({ message: 'Cannot modify admin account' });
    }

    user.status = 'active';
    await user.save();

    res.json({ message: `User ${user.name} has been approved`, user });

    // Notify user
    await createNotification({
      recipient: user._id,
      type: 'approval',
      message: 'Your account has been approved! You can now start borrowing and lending.',
      link: '/dashboard',
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Ban a user
// @route   PUT /api/admin/users/:id/ban
// @access  Admin
const banUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(400).json({ message: 'Cannot ban admin account' });
    }

    user.status = 'banned';
    await user.save();

    res.json({ message: `User ${user.name} has been banned`, user });

    // Notify user (even if they can't login, it's logged in DB)
    await createNotification({
      recipient: user._id,
      type: 'admin_alert',
      message: 'Your account has been banned due to policy violations.',
      link: '/',
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Moderator delete any item
// @route   DELETE /api/admin/items/:id
// @access  Admin
const deleteItemAsAdmin = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (item.status === 'borrowed') {
      return res.status(400).json({ message: 'Cannot delete an item that is currently borrowed' });
    }

    // Delete from Cloudinary if imagePublicId exists
    if (item.imagePublicId) {
      const cloudinary = require('../config/cloudinary');
      await cloudinary.uploader.destroy(item.imagePublicId);
    }

    const itemOwnerId = item.owner;
    const itemTitle = item.title;

    await Item.findByIdAndDelete(req.params.id);

    // Notify owner
    await createNotification({
      recipient: itemOwnerId,
      type: 'admin_alert',
      message: `Your item "${itemTitle}" has been removed by an admin for policy reasons.`,
      link: '/dashboard',
    });

    res.json({ message: 'Item deleted by admin' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get dashboard stats
// @route   GET /api/admin/stats
// @access  Admin
const getStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'user' });
    const pendingUsers = await User.countDocuments({ status: 'pending', role: 'user' });
    const activeUsers = await User.countDocuments({ status: 'active', role: 'user' });
    const bannedUsers = await User.countDocuments({ status: 'banned', role: 'user' });
    const totalItems = await Item.countDocuments();
    const availableItems = await Item.countDocuments({ status: 'available' });
    const borrowedItems = await Item.countDocuments({ status: 'borrowed' });

    res.json({
      totalUsers,
      pendingUsers,
      activeUsers,
      bannedUsers,
      totalItems,
      availableItems,
      borrowedItems,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all items (Admin inventory view)
// @route   GET /api/admin/items
// @access  Admin
const getAllItems = async (req, res) => {
  try {
    const items = await Item.find()
      .populate('owner', 'name email')
      .sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all transactions (Admin borrowing view)
// @route   GET /api/admin/transactions
// @access  Admin
const getAllTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate('item', 'title imageUrl status category')
      .populate('borrower', 'name email reputationScore')
      .populate('lender', 'name email reputationScore')
      .sort({ createdAt: -1 });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Permanently delete a user and all their data (admin moderation)
// @route   DELETE /api/admin/users/:id
// @access  Admin
const deleteUserAsAdmin = async (req, res) => {
  try {
    const userId = req.params.id;

    // Check if target is an admin
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(400).json({ message: 'Cannot delete admin account' });
    }

    const result = await deleteUserAndData(userId);

    res.json({
      message: `User ${user.name} and all their related community data have been permanently deleted.`,
      details: result
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { 
  getUsers, 
  approveUser, 
  banUser, 
  deleteItemAsAdmin, 
  getStats, 
  getAllItems, 
  getAllTransactions,
  deleteUserAsAdmin 
};
