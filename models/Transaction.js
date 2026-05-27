const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true,
  },
  borrower: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  lender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required'],
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required'],
  },
  actualReturnDate: {
    type: Date,
    default: null,
  },
  qrSecret: {
    type: String,
    default: null,
  },
  qrExpiresAt: {
    type: Date,
    default: null,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'active', 'completed', 'rejected', 'cancelled'],
    default: 'pending',
  },
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
