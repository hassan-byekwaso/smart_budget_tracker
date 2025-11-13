// backend/routes/transactionRoutes.js
// CRUD routes for transactions; protected with auth middleware

const express = require('express');
const Transaction = require('../models/Transaction');
const { protect } = require('../middleware/auth');

const router = express.Router();

/**
 * Get transaction options (types and categories)
 * GET /api/transactions/options
 */
router.get('/options', protect, (req, res) => {
  const options = {
    types: ['income', 'expense'],
    categories: [
      'Food',
      'Transport',
      'Salary',
      'Shopping',
      'Housing',
      'Bills',
      'Entertainment',
      'Other',
    ],
    descriptions: [
      'Groceries',
      'Lunch',
      'Coffee',
      'Bus Fare',
      'Train Fare'
    ],
  };
  res.json(options);
});

/**
 * Create transaction
 * POST /api/transactions
 * body: { type, category, amount, description, date? }
 */
router.post('/', protect, async (req, res) => {
  try {
    const { type, category, amount, description, date } = req.body;
    if (!type || !amount) return res.status(400).json({ message: 'Type and amount required' });

    const tx = new Transaction({
      userId: req.user._id,
      type,
      category,
      amount,
      description,
      date: date || Date.now(),
    });

    await tx.save();
    res.json(tx);
  } catch (err) {
    console.error('Create transaction error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Get all transactions for logged user
 * GET /api/transactions
 */
router.get('/', protect, async (req, res) => {
  try {
    const { category } = req.query; // Get category from query parameters
    const filter = { userId: req.user._id };

    if (category) {
      filter.category = category; // Add category to the filter if it exists
    }

    const txs = await Transaction.find(filter).sort({ date: -1 });
    res.json(txs);
  } catch (err) {
    console.error('Get txs error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Update transaction (owner only)
 * PUT /api/transactions/:id
 */
router.put('/:id', protect, async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id);
    if (!tx) return res.status(404).json({ message: 'Not found' });
    if (tx.userId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Forbidden' });

    // update fields
    const { type, category, amount, description, date } = req.body;
    tx.type = type ?? tx.type;
    tx.category = category ?? tx.category;
    tx.amount = amount ?? tx.amount;
    tx.description = description ?? tx.description;
    tx.date = date ?? tx.date;

    await tx.save();
    res.json(tx);
  } catch (err) {
    console.error('Update tx error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Delete transaction (owner only)
 * DELETE /api/transactions/:id
 */
router.delete('/:id', protect, async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id);
    if (!tx) return res.status(404).json({ message: 'Not found' });
    if (tx.userId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Forbidden' });

    await tx.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Delete tx error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
