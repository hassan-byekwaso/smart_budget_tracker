// backend/middleware/authOptional.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * This middleware is for routes that can be accessed by both authenticated and unauthenticated users.
 * If a valid JWT is provided, it attaches the user object to the request (`req.user`).
 * If no token is provided, it simply moves on without error.
 */
const authOptional = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // Find user by ID and attach to request, but don't send password
      req.user = await User.findById(decoded.id).select('-password');
    } catch (error) {
      // If token is invalid, just ignore it and proceed as an unauthenticated user.
      console.log('Optional auth: Invalid token provided. Proceeding as guest.');
      req.user = null;
    }
  }

  next();
};

module.exports = { authOptional };