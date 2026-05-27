const Item = require('../models/Item');
const Transaction = require('../models/Transaction');
const cloudinary = require('../config/cloudinary');
const { createNotification } = require('../utils/notificationService');

// @desc    Create new item with photo
// @route   POST /api/items
// @access  Active Users
const createItem = async (req, res) => {
  try {
    const { title, description, category } = req.body;

    if (!title || !description || !category) {
      return res.status(400).json({ message: 'Title, description, and category are required' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Item photo is mandatory' });
    }

    const item = await Item.create({
      title,
      description,
      category,
      owner: req.user._id,
      imageUrl: req.file.path,
      imagePublicId: req.file.filename,
    });

    await item.populate('owner', 'name email reputationScore');

    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all available items
// @route   GET /api/items
// @access  Active Users
const getItems = async (req, res) => {
  try {
    const { search, category, status } = req.query;
    const filter = {};

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (category && category !== 'all') {
      filter.category = category;
    }

    if (status) {
      filter.status = status;
    } else {
      filter.status = 'available';
    }

    const items = await Item.find(filter)
      .populate('owner', 'name email reputationScore')
      .sort({ createdAt: -1 });

    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get single item
// @route   GET /api/items/:id
// @access  Active Users
const getItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id)
      .populate('owner', 'name email reputationScore');

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.json(item);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update item (owner only, not if borrowed)
// @route   PUT /api/items/:id
// @access  Owner only
const updateItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Ownership guard
    if (item.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only edit your own items' });
    }

    // State locking
    if (item.status === 'borrowed') {
      return res.status(400).json({ message: 'Cannot edit an item that is currently borrowed' });
    }

    const { title, description, category } = req.body;
    if (title) item.title = title;
    if (description) item.description = description;
    if (category) item.category = category;

    // If new photo uploaded, replace old one in Cloudinary
    if (req.file) {
      if (item.imagePublicId) {
        try {
          await cloudinary.uploader.destroy(item.imagePublicId);
        } catch (cloudErr) {
          console.error('[updateItem] Failed to delete old Cloudinary image:', cloudErr.message);
          // Continue — new image is still saved
        }
      }
      item.imageUrl = req.file.path;
      item.imagePublicId = req.file.filename;
    }

    await item.save();
    await item.populate('owner', 'name email reputationScore');

    res.json(item);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Delete item (owner or admin only, not if currently borrowed)
// @route   DELETE /api/items/:id
// @access  Owner or Admin
const deleteItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Authorization: only owner or admin
    const isOwner = item.owner.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'You can only delete your own items' });
    }

    // Block deletion if item is currently borrowed (active transaction)
    if (item.status === 'borrowed') {
      return res.status(400).json({ message: 'Cannot delete an item that is currently borrowed' });
    }

    // ── Step 1: Delete image from Cloudinary ────────────────────────────
    if (item.imagePublicId) {
      try {
        const result = await cloudinary.uploader.destroy(item.imagePublicId);
        if (result.result !== 'ok' && result.result !== 'not found') {
          console.warn(`[deleteItem] Cloudinary deletion returned unexpected result for "${item.imagePublicId}":`, result.result);
        }
      } catch (cloudErr) {
        // Log but don't block deletion — item should still be removed from DB
        console.error('[deleteItem] Cloudinary error:', cloudErr.message);
      }
    } else {
      console.warn(`[deleteItem] Item "${item._id}" has no imagePublicId — Cloudinary image may be orphaned`);
    }

    // ── Step 2: Cancel / remove any open transactions for this item ─────
    // (pending or approved transactions become meaningless once the item is gone)
    const openTransactions = await Transaction.find({
      item: item._id,
      status: { $in: ['pending', 'approved'] },
    });

    if (openTransactions.length > 0) {
      // Mark them cancelled so borrowers are aware
      await Transaction.updateMany(
        { item: item._id, status: { $in: ['pending', 'approved'] } },
        { $set: { status: 'cancelled' } }
      );

      // Notify affected borrowers
      for (const txn of openTransactions) {
        await createNotification({
          recipient: txn.borrower,
          type: 'admin_alert',
          message: `The item "${item.title}" you requested has been deleted by the ${isAdmin && !isOwner ? 'admin' : 'owner'}. Your request has been cancelled.`,
          link: '/my-borrowings',
        });
      }
    }

    // ── Step 3: Delete the item document from MongoDB ───────────────────
    await Item.findByIdAndDelete(req.params.id);

    // ── Step 4: Notify owner if deleted by an admin ─────────────────────
    if (isAdmin && !isOwner) {
      await createNotification({
        recipient: item.owner,
        type: 'admin_alert',
        message: `Your item "${item.title}" has been removed by an admin for policy reasons.`,
        link: '/dashboard',
      });
    }

    res.json({
      message: 'Item deleted successfully',
      cancelledTransactions: openTransactions.length,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get current user's items
// @route   GET /api/items/my/items
// @access  Active Users
const getMyItems = async (req, res) => {
  try {
    const items = await Item.find({ owner: req.user._id })
      .populate('owner', 'name email reputationScore')
      .sort({ createdAt: -1 });

    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { createItem, getItems, getItem, updateItem, deleteItem, getMyItems };
