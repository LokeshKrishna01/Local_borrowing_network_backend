const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const { deleteUserAndData } = require('../utils/deleteUserHelper');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { name, email, password } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    // Create user with pending status and unverified email
    const user = await User.create({
      name,
      email,
      password,
      role: 'user',
      status: 'pending',
      verificationOtp: otp,
      otpExpiresAt,
    });

    console.log(`🔑 [OTP] User registered: ${email} | Generated OTP Code: ${otp}`);

    // Send OTP email
    const message = `Welcome to NeighborGoods!\n\nYour email verification code is: ${otp}\n\nThis code will expire in 15 minutes.`;
    let emailSent = true;
    try {
      await sendEmail({
        email: user.email,
        subject: 'NeighborGoods - Verify your email',
        message,
      });
    } catch (emailError) {
      console.error('Failed to send OTP email:', emailError.message);
      emailSent = false;
    }

    res.status(201).json({
      message: emailSent
        ? 'Registration successful! An OTP has been sent to your email to verify your account.'
        : `Registration successful! However, we couldn't send the verification email. Your OTP code is: ${otp}`,
      email: user.email,
      otp: emailSent ? undefined : otp, // Expose OTP only if email fails
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ message: 'Please provide email and OTP' });
    }

    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.isEmailVerified) {
      return res.status(400).json({ message: 'Email is already verified' });
    }
    
    if (user.verificationOtp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }
    
    if (new Date() > new Date(user.otpExpiresAt)) {
      return res.status(400).json({ message: 'OTP has expired. Please register again or request a new OTP.' });
    }
    
    // Mark as verified, clear OTP
    user.isEmailVerified = true;
    user.verificationOtp = undefined;
    user.otpExpiresAt = undefined;
    await user.save();
    
    res.json({ message: 'Email verified successfully! You can now log in (pending admin approval).' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(403).json({ message: 'Please verify your email before logging in.' });
    }

    // Check if user is banned
    if (user.status === 'banned') {
      return res.status(403).json({ message: 'Your account has been banned. Contact admin.' });
    }

    // Compare passwords
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        reputationScore: user.reputationScore,
        profilePicture: user.profilePicture || '',
        address: user.address || '',
        phone: user.phone || '',
        bio: user.bio || '',
      },
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      reputationScore: user.reputationScore,
      profilePicture: user.profilePicture || '',
      address: user.address || '',
      phone: user.phone || '',
      bio: user.bio || '',
      createdAt: user.createdAt,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Google Authentication
// @route   POST /api/auth/google
// @access  Public
const googleAuth = async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ message: 'No Google token provided' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const { name, email, sub: googleId } = ticket.getPayload();

    let user = await User.findOne({ email });

    if (!user) {
      // Create new user via Google
      user = await User.create({
        name,
        email,
        googleId,
        role: 'user',
        status: 'pending',
        isEmailVerified: true,
      });
    } else {
      // If user exists but hasn't linked Google yet
      if (!user.googleId) {
        user.googleId = googleId;
        user.isEmailVerified = true; // Google verifies the email
        await user.save();
      }
    }

    // Check if user is banned
    if (user.status === 'banned') {
      return res.status(403).json({ message: 'Your account has been banned. Contact admin.' });
    }

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        reputationScore: user.reputationScore,
        profilePicture: user.profilePicture || '',
        address: user.address || '',
        phone: user.phone || '',
        bio: user.bio || '',
      },
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(500).json({ message: 'Google authentication failed', error: error.message });
  }
};

// @desc    Delete logged-in user profile & all related data
// @route   DELETE /api/auth/profile
// @access  Private
const deleteProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    // Check if user is an admin (we should not allow deleting the seed root admin)
    const user = await User.findById(userId);
    if (user && user.role === 'admin') {
      return res.status(400).json({ message: 'Admin profile cannot be deleted.' });
    }

    const result = await deleteUserAndData(userId);
    
    res.json({
      message: 'Your profile and all related data have been successfully deleted.',
      details: result
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update current user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { name, profilePicture, address, phone, bio } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (name) user.name = name;
    if (profilePicture !== undefined) user.profilePicture = profilePicture;
    if (address !== undefined) user.address = address;
    if (phone !== undefined) user.phone = phone;
    if (bio !== undefined) user.bio = bio;

    await user.save();

    res.json({
      message: 'Profile updated successfully!',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        reputationScore: user.reputationScore,
        profilePicture: user.profilePicture || '',
        address: user.address || '',
        phone: user.phone || '',
        bio: user.bio || '',
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { register, login, getMe, verifyOTP, googleAuth, deleteProfile, updateProfile };
