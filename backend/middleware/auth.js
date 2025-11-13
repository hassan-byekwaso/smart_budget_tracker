// backend/middleware/auth.js
// JWT middleware: protects routes by checking Authorization header

const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    
    // If no token, and the route is for mpesa, we can proceed as an unauthenticated user.
    // Otherwise, for all other protected routes, we must have a token.
    if (!token) {
      if (req.path === '/stk-push' && req.baseUrl === '/api/mpesa') return next();
      return res.status(401).json({ message: 'Not authorized, token missing' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const dbUser = await User.findById(decoded.id || decoded._id).select('-password -__v');
    if (!dbUser) return res.status(401).json({ message: 'Not authorized, user not found' });

    // attach both _id and id for compatibility
    req.user = {
      _id: dbUser._id,
      id: dbUser._id, // Keep as ObjectId for consistency
      name: dbUser.name || dbUser.username || '',
      email: dbUser.email,
      hasPaid: !!dbUser.hasPaid,
      phone: dbUser.phone // Add phone to the user object
    };

    next();
  } catch (err) {
    console.error('Protect middleware error:', err);
    return res.status(401).json({ message: 'Not authorized' });
  }
};
module.exports = exports;
