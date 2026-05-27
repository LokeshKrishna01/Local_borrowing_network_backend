const express = require('express');
const { protect, requireActive } = require('../middleware/auth');
const {
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
} = require('../controllers/transactionController');

const router = express.Router();

// All transaction routes require auth + active status
router.use(protect, requireActive);

router.post('/borrow', requestBorrow);
router.put('/:id/approve', approveRequest);
router.put('/:id/reject', rejectRequest);
router.delete('/:id/cancel', cancelBorrow);
router.get('/my-borrowings', getMyBorrowings);
router.get('/lend-requests', getLendRequests);
router.post('/:id/generate-qr', generateQR);
router.post('/:id/verify-return', verifyReturn);
router.post('/:id/generate-handover-qr', generateHandoverQR);
router.post('/:id/verify-handover', verifyHandover);

module.exports = router;
