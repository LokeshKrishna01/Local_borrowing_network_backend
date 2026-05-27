const express = require('express');
const { body } = require('express-validator');
const { register, login, getMe, verifyOTP, googleAuth, deleteProfile } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
  ],
  register
);

router.post('/login', login);
router.post('/verify-otp', verifyOTP);
router.post('/google', googleAuth);

router.get('/me', protect, getMe);
router.delete('/profile', protect, deleteProfile);

module.exports = router;
