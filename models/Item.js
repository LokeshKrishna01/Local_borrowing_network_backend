const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: 100,
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: 500,
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['tools', 'textbooks', 'camping', 'kitchen', 'electronics', 'sports', 'other'],
    default: 'other',
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  imageUrl: {
    type: String,
    required: [true, 'Item photo is mandatory'],
  },
  imagePublicId: {
    type: String,
  },
  status: {
    type: String,
    enum: ['available', 'borrowed'],
    default: 'available',
  },
}, { timestamps: true });

module.exports = mongoose.model('Item', itemSchema);
