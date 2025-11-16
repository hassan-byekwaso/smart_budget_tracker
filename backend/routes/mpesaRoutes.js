const express = require('express');
const { stkPush: darajaStkPush } = require('../lib/daraja');
const { getIo } = require('../socketManager'); // Use getIo to broadcast
const { authOptional } = require('../middleware/authOptional'); // Import the new middleware
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const router = express.Router();

async function handleNewUserStkPush(req, res) {
  const { name, email, password, phone, amount, socketId: socketId } = req.body;
  if (!name || !email || !password || !phone || !amount || !socketId) {
    return res.status(400).json({ message: 'Name, email, password, phone, amount, and socketId are required for registration.' });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser && existingUser.hasPaid) {
    return res.status(400).json({ message: 'An active account with this email already exists. Please log in.' });
  }

  const userDataForStore = { name, email, password, socketId, isNewUser: true };

  // Common STK Push logic
  await initiateStkPush(req, res, { phone, amount, userEmail: email, userDataForStore });
}

async function handleExistingUserStkPush(req, res) {
  const { phone, amount, socketId: socketId } = req.body;
  if (!phone || !amount || !socketId) {
    return res.status(400).json({ message: 'Phone, amount, and socketId are required.' });
  }

  const userDataForStore = { userId: req.user._id, socketId, isNewUser: false };

  // Common STK Push logic
  await initiateStkPush(req, res, { phone, amount, userEmail: req.user.email, userDataForStore });
}

async function initiateStkPush(req, res, { phone, amount, userEmail, userDataForStore }) {
  // Ensure phone number is in the correct format (e.g., 2547XXXXXXXX)
  let formattedPhone = phone.trim();
  if (formattedPhone.startsWith('0')) {
    formattedPhone = `254${formattedPhone.substring(1)}`;
  } else if (!formattedPhone.startsWith('254')) {
    return res.status(400).json({ message: 'Invalid phone number format. Please start with 07, 01, or 254.' });
  }

  console.log(`[STK INITIATE] Request for ${userEmail} with phone ${formattedPhone}`);

  const darajaResponse = await darajaStkPush({
    phone: formattedPhone,
    amount: amount,
    accountRef: `BudgetTracker-${userEmail.split('@')[0]}`, // A more specific reference
  });

  // Temporarily store registration details with the CheckoutRequestID to be retrieved in the callback
  const tempStore = req.app.get('tempStore');
  tempStore.set(darajaResponse.CheckoutRequestID, userDataForStore);

  console.log(`[STK INITIATE] Stored temp data for CheckoutRequestID: ${darajaResponse.CheckoutRequestID}`);

  // Auto-delete after 5 minutes to prevent memory leaks
  setTimeout(() => {
    if (tempStore.has(darajaResponse.CheckoutRequestID)) {
      console.log(`[STK CLEANUP] Deleting temp data for ${darajaResponse.CheckoutRequestID}`);
      tempStore.delete(darajaResponse.CheckoutRequestID);
    }
  }, 5 * 60 * 1000);
  
  res.json({
    message: 'STK Push initiated. Please check your phone to complete the payment.',
    CheckoutRequestID: darajaResponse.CheckoutRequestID,
    MerchantRequestID: darajaResponse.MerchantRequestID,
  });
}

/**
 * Initiate M-Pesa STK Push
 * This route handles two cases:
 * 1. New user registration (unauthenticated): requires name, email, password, phone, amount, socketId
 * 2. Existing user payment (authenticated): requires phone, amount, socketId. It uses the logged-in user's ID.
 * POST /api/mpesa/stk-push
 */
router.post('/stk-push', authOptional, async (req, res) => { // Apply the middleware here
  try {
    const isNewUser = !req.user; // Check if a user is logged in via 'protect' middleware

    if (isNewUser) {
      await handleNewUserStkPush(req, res);
    } else {
      await handleExistingUserStkPush(req, res);
    }
  } catch (err) { // A single catch block to handle all errors
    console.error('STK Push initiation error:', err.message);
    res.status(500).json({ message: err.message || 'Failed to initiate STK Push. Please try again.' });
  }
});

/**
 * M-Pesa Callback URL
 * POST /api/mpesa/callback
 * This endpoint is called by Safaricom Daraja after a payment attempt.
 */
router.post('/callback', async (req, res) => {
  try {
    const callbackData = req.body.Body.stkCallback;
    console.log('M-Pesa Callback Received:', JSON.stringify(callbackData, null, 2));

    const { CheckoutRequestID, ResultCode, ResultDesc } = callbackData;

    // Retrieve the temporary registration data
    const tempStore = req.app.get('tempStore');
    const userData = tempStore.get(CheckoutRequestID);

    const io = getIo();

    if (!userData) {
      console.error(`[CALLBACK ERROR] No temporary user data found for CheckoutRequestID: ${CheckoutRequestID}. Might be late or invalid.`);
      // Acknowledge Safaricom, but log the error.
      return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted", message: 'Callback received, but no pending registration found.' });
    }

    console.log(`[CALLBACK] Found user data for ${CheckoutRequestID}:`, userData);
    const { socketId, isNewUser } = userData;

    if (ResultCode === 0) {
      // Payment was successful
      console.log(`[CALLBACK SUCCESS] Payment successful for ${CheckoutRequestID}.`);

      try {
        if (isNewUser) {
          // Create a new user
          const { name, email, password } = userData;
          let user = await User.findOne({ email });

          if (!user) {
            // If user does not exist, create them
            user = new User({ name, email, password: password }); // Pass the plain password
            console.log(`[DB] User ${email} created successfully after payment.`);
          }

          user.hasPaid = true;
          await user.save();
          console.log(`[DB] User ${email} is now marked as paid.`);

          io.to(socketId).emit('registration-success', { message: 'Payment successful! Your account has been created. You can now log in.', email: email });
        } else {
          // Update an existing user
          const { userId } = userData;
          const user = await User.findById(userId);
          if (user) {
            user.hasPaid = true;
            await user.save();
            console.log(`[DB] Payment confirmed for existing user: ${user.email}`);
            io.to(socketId).emit('payment-success', { message: 'Payment successful! Your account is now active.', email: user.email });
          } else {
            console.error(`[DB ERROR] User with ID ${userId} not found for payment update.`);
            io.to(socketId).emit('payment-failure', { message: `Payment successful, but failed to update your account. Please contact support.` });
          }
        }
        // Clean up the temporary store only on success
        tempStore.delete(CheckoutRequestID);
      } catch (dbError) {
        console.error(`[DB ERROR] Failed to save user after successful payment for ${CheckoutRequestID}:`, dbError);
        io.to(socketId).emit('payment-failure', { message: `Payment successful, but a server error occurred. Please contact support.` });
      }

    } else {
      // Payment failed or was cancelled
      console.log(`[CALLBACK FAILURE] Payment failed for ${CheckoutRequestID}. ResultCode: ${ResultCode}, ResultDesc: ${ResultDesc}`);
      io.to(socketId).emit(isNewUser ? 'registration-failure' : 'payment-failure', { message: `Payment not successful: ${ResultDesc}` });
      tempStore.delete(CheckoutRequestID); // Clean up on failure too
    }

    res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted", message: "Callback received successfully." }); // Acknowledge M-Pesa
  } catch (err) {
    console.error('M-Pesa Callback processing error:', err.message);
    res.status(500).json({ ResultCode: 1, ResultDesc: "Failed", message: 'Error processing callback.' });
  }
});

module.exports = router;