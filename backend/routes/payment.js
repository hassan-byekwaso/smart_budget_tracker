// backend/routes/payment.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');

// @route   POST api/payment/confirm
// @desc    Confirm a user's payment
// @access  Private
router.post('/confirm', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.hasPaid = true;
    await user.save();

    res.json({ message: 'Payment successful! You now have full access.' });
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;