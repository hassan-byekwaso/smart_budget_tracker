// backend/server.js
const express = require('express');
const http = require('http');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const cors = require('cors');
const { setIo } = require('./socketManager');
const connectDB = require('./config/db');
const { protect } = require('./middleware/auth');
const { checkPaidStatus } = require('./middleware/paid');

dotenv.config();

const app = express();
const server = http.createServer(app);

// Simple in-memory store for pending M-Pesa registrations
app.set('tempStore', new Map());

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json()); // parse JSON

// Correct usage of middleware - moved up to log all requests
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.path}`);
  next();
});

// Add this before your routes
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Connect DB
connectDB();

// Public auth routes
app.use('/api/auth', require('./routes/authRoutes'));
// M-Pesa routes are public for registration payment and callbacks
app.use('/mpesa', require('./routes/mpesaRoutes'));

// The '/api/payment' route is redundant due to the M-Pesa workflow and has been removed.
// app.use('/api/payment', require('./routes/payment'));

// Protected routes: require auth, and require payment for transactions (example)
app.use('/api/transactions', protect, checkPaidStatus, require('./routes/transactionRoutes'));

// simple health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Initialize Socket.IO and export it
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Pass the io instance to the socketManager
setIo(io);

io.on('connection', (socket) => {
  console.log(`🔌 New client connected: ${socket.id}`);
});

// Add this after your routes
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
