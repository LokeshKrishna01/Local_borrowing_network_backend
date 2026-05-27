const Transaction = require('../models/Transaction');
const Item = require('../models/Item');
const User = require('../models/User');
const { generateQRSecret, validateQRSecret } = require('../utils/qrHelper');
const { createNotification } = require('../utils/notificationService');

// @desc    Request to borrow an item
// @route   POST /api/transactions/borrow
// @access  Active Users
const requestBorrow = async (req, res) => {
  try {
    const { itemId, startDate, endDate } = req.body;

    if (!itemId || !startDate || !endDate) {
      return res.status(400).json({ message: 'Item ID, start date, and end date are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      return res.status(400).json({ message: 'End date must be after start date' });
    }

    if (start < new Date()) {
      return res.status(400).json({ message: 'Start date cannot be in the past' });
    }

    // Find item
    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Cannot borrow own item
    if (item.owner.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot borrow your own item' });
    }

    // Check for date overlap with existing active/approved transactions
    const overlapping = await Transaction.findOne({
      item: itemId,
      status: { $in: ['approved', 'active'] },
      $or: [
        { startDate: { $lte: end }, endDate: { $gte: start } },
      ],
    });

    if (overlapping) {
      return res.status(400).json({
        message: 'This item is already booked for the selected dates',
      });
    }

    const transaction = await Transaction.create({
      item: itemId,
      borrower: req.user._id,
      lender: item.owner,
      startDate: start,
      endDate: end,
      status: 'pending',
    });

    await transaction.populate([
      { path: 'item', select: 'title imageUrl' },
      { path: 'borrower', select: 'name email' },
      { path: 'lender', select: 'name email' },
    ]);

    res.status(201).json({ message: 'Borrow request sent!', transaction });

    // Notify lender
    await createNotification({
      recipient: item.owner,
      sender: req.user._id,
      type: 'request',
      message: `${req.user.name} wants to borrow your ${item.title}.`,
      link: '/lend-requests',
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Approve a borrow request (lender only)
// @route   PUT /api/transactions/:id/approve
// @access  Lender
const approveRequest = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (transaction.lender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the lender can approve this request' });
    }

    if (transaction.status !== 'pending') {
      return res.status(400).json({ message: 'This request is no longer pending' });
    }

    transaction.status = 'approved';
    await transaction.save();

    await transaction.populate([
      { path: 'item', select: 'title imageUrl' },
      { path: 'borrower', select: 'name email' },
    ]);

    res.json({ message: 'Request approved! Now perform physical handover.', transaction });

    // Notify borrower
    await createNotification({
      recipient: transaction.borrower,
      sender: req.user._id,
      type: 'approval',
      message: `Your request for ${transaction.item.title} was approved! Please scan the lender's handover QR code to confirm receipt.`,
      link: '/my-borrowings',
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Reject a borrow request (lender only)
// @route   PUT /api/transactions/:id/reject
// @access  Lender
const rejectRequest = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (transaction.lender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the lender can reject this request' });
    }

    if (transaction.status !== 'pending') {
      return res.status(400).json({ message: 'This request is no longer pending' });
    }

    transaction.status = 'rejected';
    await transaction.save();

    res.json({ message: 'Request rejected', transaction });

    // Notify borrower
    await createNotification({
      recipient: transaction.borrower,
      sender: req.user._id,
      type: 'rejection',
      message: `Your request for ${transaction.item?.title || 'an item'} was rejected.`,
      link: '/my-borrowings',
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get borrower's transactions
// @route   GET /api/transactions/my-borrowings
// @access  Active Users
const getMyBorrowings = async (req, res) => {
  try {
    const transactions = await Transaction.find({ borrower: req.user._id })
      .populate('item', 'title imageUrl status category')
      .populate('lender', 'name email')
      .sort({ createdAt: -1 });

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get lender's incoming requests
// @route   GET /api/transactions/lend-requests
// @access  Active Users
const getLendRequests = async (req, res) => {
  try {
    const transactions = await Transaction.find({ lender: req.user._id })
      .populate('item', 'title imageUrl status category')
      .populate('borrower', 'name email reputationScore')
      .sort({ createdAt: -1 });

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Generate time-sensitive QR code for return (borrower)
// @route   POST /api/transactions/:id/generate-qr
// @access  Borrower
const generateQR = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (transaction.borrower.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the borrower can generate a return QR code' });
    }

    if (transaction.status !== 'active') {
      return res.status(400).json({ message: 'Can only generate QR for active transactions' });
    }

    const { secret, expiresAt } = generateQRSecret();
    transaction.qrSecret = secret;
    transaction.qrExpiresAt = expiresAt;
    await transaction.save();

    res.json({
      message: 'QR code generated. Show this to the lender within 10 minutes.',
      qrData: JSON.stringify({
        transactionId: transaction._id,
        secret: secret,
      }),
      expiresAt,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Generate time-sensitive QR code for handover (lender)
// @route   POST /api/transactions/:id/generate-handover-qr
// @access  Lender
const generateHandoverQR = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (transaction.lender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the lender can generate a handover QR code' });
    }

    if (transaction.status !== 'approved') {
      return res.status(400).json({ message: 'Can only generate handover QR for approved transactions' });
    }

    const { secret, expiresAt } = generateQRSecret();
    transaction.qrSecret = secret;
    transaction.qrExpiresAt = expiresAt;
    await transaction.save();

    res.json({
      message: 'Handover QR generated. Show this to the borrower within 10 minutes.',
      qrData: JSON.stringify({
        transactionId: transaction._id,
        secret: secret,
        type: 'handover'
      }),
      expiresAt,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Verify handover via QR scan (borrower)
// @route   POST /api/transactions/:id/verify-handover
// @access  Borrower
const verifyHandover = async (req, res) => {
  try {
    const { secret } = req.body;
    const transaction = await Transaction.findById(req.params.id).populate('item');

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (transaction.borrower.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the borrower can verify a handover' });
    }

    if (transaction.status !== 'approved') {
      return res.status(400).json({ message: 'This transaction is not in approved state' });
    }

    // Validate QR secret
    const result = validateQRSecret(secret, transaction);
    if (!result.valid) {
      return res.status(400).json({ message: result.message });
    }

    // Complete the handover
    transaction.status = 'active';
    transaction.qrSecret = null;
    transaction.qrExpiresAt = null;
    await transaction.save();

    // Update item status to borrowed
    await Item.findByIdAndUpdate(transaction.item._id, { status: 'borrowed' });

    res.json({
      message: 'Handover verified successfully! You now have the item.',
      transaction,
    });

    // Notify lender
    await createNotification({
      recipient: transaction.lender,
      sender: req.user._id,
      type: 'approval',
      message: `${req.user.name} has confirmed receipt of ${transaction.item.title}.`,
      link: '/lend-requests',
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Verify return via QR scan (lender)
// @route   POST /api/transactions/:id/verify-return
// @access  Lender
const verifyReturn = async (req, res) => {
  try {
    const { secret } = req.body;
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (transaction.lender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the lender can verify a return' });
    }

    if (transaction.status !== 'active') {
      return res.status(400).json({ message: 'This transaction is not active' });
    }

    // Validate QR secret
    const result = validateQRSecret(secret, transaction);
    if (!result.valid) {
      return res.status(400).json({ message: result.message });
    }

    // Complete the return
    transaction.status = 'completed';
    transaction.actualReturnDate = new Date();
    transaction.qrSecret = null;
    transaction.qrExpiresAt = null;
    await transaction.save();

    // Update item status back to available
    await Item.findByIdAndUpdate(transaction.item, { status: 'available' });

    // Update reputation score based on return timing
    const borrower = await User.findById(transaction.borrower);
    if (borrower) {
      const isLate = new Date() > new Date(transaction.endDate);
      if (isLate) {
        borrower.reputationScore = Math.max(0, borrower.reputationScore - 10);
      } else {
        borrower.reputationScore = Math.min(200, borrower.reputationScore + 5);
      }
      await borrower.save();
    }

    res.json({
      message: 'Return verified successfully! Item is now available.',
      transaction,
    });

    // Notify borrower
    await createNotification({
      recipient: transaction.borrower,
      sender: req.user._id,
      type: 'return',
      message: `Return verified for ${transaction.item?.title || 'your item'}. Your reputation score was updated!`,
      link: '/my-borrowings',
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Cancel a borrow request (borrower only)
// @route   DELETE /api/transactions/:id/cancel
// @access  Borrower
const cancelBorrow = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (transaction.borrower.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the borrower can cancel this request' });
    }

    if (!['pending', 'approved'].includes(transaction.status)) {
      return res.status(400).json({ message: 'Can only cancel pending or approved requests' });
    }

    // Instead of deleting, we could mark as cancelled, 
    // but deleting keeps the inventory clean if it's just a pending request.
    // However, the user said "borrowing can be canceled", so let's set status to 'cancelled'.
    transaction.status = 'cancelled';
    await transaction.save();

    res.json({ message: 'Borrow request cancelled', transactionId: req.params.id });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  requestBorrow,
  approveRequest,
  rejectRequest,
  getMyBorrowings,
  getLendRequests,
  generateQR,
  verifyReturn,
  cancelBorrow,
  generateHandoverQR,
  verifyHandover,
};
