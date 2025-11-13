// backend/lib/daraja.js
// Daraja helper: get access token & perform STK Push
// Uses Safaricom Daraja sandbox endpoints

const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

// Read from env
const consumerKey = process.env.CONSUMER_KEY;
const consumerSecret = process.env.CONSUMER_SECRET;
const shortcode = process.env.SHORTCODE;
const passkey = process.env.PASSKEY;
const callbackUrl = process.env.CALLBACK_URL;

if (!callbackUrl) {
  console.error("FATAL ERROR: CALLBACK_URL is not defined in your .env file.");
  process.exit(1); // Exit the process with an error code
}

/**
 * Get Daraja OAuth access token
 */
const getAccessToken = async () => {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const url = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
  try {
    const res = await axios.get(url, { headers: { Authorization: `Basic ${auth}` } });
    return res.data.access_token;
  } catch (err) {
    console.error('Error getting access token:', err.response ? err.response.data : err.message);
    throw new Error('Could not get Daraja access token. Please check your consumer key and secret.');
  }
};

/**
 * STK Push (CustomerPayBillOnline)
 * phone: in format 2547XXXXXXXX or 07XXXXXXXX (daraja expects 2547... ideally)
 * amount: number or string
 * accountRef: order id or description
 */
const stkPush = async ({ phone, amount, accountRef }) => {
  const token = await getAccessToken();
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const password = Buffer.from(shortcode + passkey + timestamp).toString('base64');

  const body = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: String(amount),
    PartyA: phone,         // msisdn paying
    PartyB: shortcode,     // till/shortcode receiving
    PhoneNumber: phone,
    CallBackURL: callbackUrl,
    AccountReference: accountRef || 'Budget Tracker',
    TransactionDesc: 'Payment for Personal Budget Tracker',
  };

  try {
    const res = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      body,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data; // includes MerchantRequestID and CheckoutRequestID
  } catch (err) {
    // Re-throw the error to be caught by the route handler
    throw new Error(err.response ? JSON.stringify(err.response.data) : err.message);
  }
};

module.exports = { getAccessToken, stkPush };
