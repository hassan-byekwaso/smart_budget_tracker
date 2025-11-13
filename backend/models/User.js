// backend/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String }, // Add phone number field
    hasPaid: { type: Boolean, default: false },
    mpesaCheckoutRequestId: {
      type: String,
    },
    subscription: {
      plan: {
        type: String,
        enum: ['free', 'premium'],
        default: 'free',
      },
      expires: {
        type: Date,
        default: null,
      },
      paymentId: {
        type: String,
      },
    },
  },
  { timestamps: true }
);

// Password hashing and comparison methods from your authRoutes
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
module.exports = User;