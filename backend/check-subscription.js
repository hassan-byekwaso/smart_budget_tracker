// backend/middleware/check-subscription.js

const checkSubscription = (req, res, next) => {
  // This middleware should run after the `protect` middleware,
  // so `req.user` will be available.
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  const { plan, expires } = req.user.subscription;

  if (plan !== 'premium' || (expires && new Date() > new Date(expires))) {
    return res.status(402).json({ message: 'Premium subscription required to access this feature.' });
  }

  next();
};

module.exports = { checkSubscription };