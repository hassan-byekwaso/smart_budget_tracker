// backend/server.js
const express = require('express');
const http = require('http');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const { initSocket } = require('./socketManager');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Create a temporary store for M-Pesa requests
const tempStore = new Map();
app.set('tempStore', tempStore);

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/mpesa', require('./routes/mpesaRoutes'));
app.use('/api/payment', require('./routes/payment'));

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = initSocket(server);

// Make io accessible to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});