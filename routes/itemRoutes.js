const express = require('express');
const { protect, requireActive } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  createItem,
  getItems,
  getItem,
  updateItem,
  deleteItem,
  getMyItems,
} = require('../controllers/itemController');

const router = express.Router();

// All item routes require auth + active status
router.use(protect, requireActive);

router.post('/', upload.single('image'), createItem);
router.get('/', getItems);
router.get('/my/items', getMyItems);
router.get('/:id', getItem);
router.put('/:id', upload.single('image'), updateItem);
router.delete('/:id', deleteItem);

module.exports = router;
