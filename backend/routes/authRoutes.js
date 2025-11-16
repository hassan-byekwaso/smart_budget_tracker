// backend/routes/authRoutes.js
// Register and login routes

const express = require('express');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

/**
 * Login
 * POST /api/auth/login
 * body: { email, password }
 */
router.post('/login', async (req, res) => { // Note: No bcrypt is needed here anymore
  const { email, password } = req.body;
  try {
    console.log("Incoming login data:", req.body);
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      console.log(`User with email "${email}" not found.`);
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    console.log('User found:', user.email);

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      console.log(`Password mismatch for user: ${email}`);
      return res.status(400).json({ message: 'Invalid credentials' }); // Passwords don't match
    }

    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        hasPaid: user.hasPaid,
      },
    });
    console.log(`Login successful for ${email}!`);
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Middleware to check payment status after authentication.
 * This can be applied to any route that requires a paid user.
 */
const checkPaidStatus = async (req, res, next) => {
  try {
    // req.user is attached by the 'protect' middleware
    const user = await User.findById(req.user._id);
    if (user && !user.hasPaid) {
      return res.status(402).json({ message: 'Payment required to access this resource.' });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error while checking payment status.' });
  }
};

/**
 * Get current user profile (including subscription status)
 * GET /api/auth/me
 */
router.get('/me', protect, (req, res) => {
  // req.user is attached by the 'protect' middleware
  res.json(req.user);
});

// Mark current user as paid (protected)
router.post('/mark-paid', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.hasPaid = true;
    await user.save();

    // return updated user (omit sensitive fields)
    const safeUser = {
      id: user._id,
      name: user.name,
      email: user.email,
      hasPaid: user.hasPaid
    };

    return res.json({ message: 'Payment recorded', user: safeUser });
  } catch (err) {
    console.error('mark-paid error', err);
    return res.status(500).json({ message: 'Server error marking payment' });
  }
});

module.exports = router;
