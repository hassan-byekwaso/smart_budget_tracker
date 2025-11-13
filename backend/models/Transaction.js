// backend/models/Transaction.js
// Each transaction belongs to a user (userId). Type is 'income' or 'expense'.

const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['income', 'expense'], required: true },
  category: { type: String },
  amount: { type: Number, required: true },
  description: { type: String },
  date: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Transaction', TransactionSchema);
