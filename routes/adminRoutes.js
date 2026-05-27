const express = require('express');
const { protect } = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');
const {
  getUsers,
  approveUser,
  banUser,
  deleteItemAsAdmin,
  getStats,
  getAllItems,
  getAllTransactions
} = require('../controllers/adminController');

const router = express.Router();

// All admin routes require auth + admin role
router.use(protect, isAdmin);

router.get('/users', getUsers);
router.put('/users/:id/approve', approveUser);
router.put('/users/:id/ban', banUser);
router.delete('/items/:id', deleteItemAsAdmin);
router.get('/stats', getStats);
router.get('/items', getAllItems);
router.get('/transactions', getAllTransactions);

module.exports = router;
