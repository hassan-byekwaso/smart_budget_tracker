const User = require('../models/User');

exports.checkPaidStatus = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    // Fetch the user from DB to ensure payment status is up-to-date
    const user = await User.findById(req.user.id || req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (!user.hasPaid) {
      return res.status(402).json({ message: 'Payment required to access this feature.' });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error while checking payment status.' });
  }
};