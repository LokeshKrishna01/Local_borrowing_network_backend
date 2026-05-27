const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT and attach user to request
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized — no token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ message: 'User no longer exists' });
    }

    if (user.status === 'banned') {
      return res.status(403).json({ message: 'Your account has been banned' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized — invalid token' });
  }
};

// Require active status (blocks pending users)
const requireActive = (req, res, next) => {
  // Allow admins to pass regardless of status, as they are the ones who approve others
  if (req.user.role === 'admin' || req.user.status === 'active') {
    return next();
  }

  return res.status(403).json({
    message: 'Account not yet approved. Please wait for admin verification.',
    status: req.user.status,
  });
};

module.exports = { protect, requireActive };
