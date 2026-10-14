import Razorpay from 'razorpay';
import connectToDatabase from './db.js';
import User from './models/User.js';
import { isCollegeEmail } from './utils/emailValidator.js';
import { getPaidChancesPack, getPaidChancesPrice } from './utils/chanceConfig.js';
import dotenv from 'dotenv';
dotenv.config();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const keyId = process.env.RAZORPAY_KEY_ID?.trim();
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

    if (!keyId || !keySecret) {
      return res.status(500).json({ error: 'Razorpay keys not configured on server' });
    }

    let body = req.body;
    if (Buffer.isBuffer(body)) {
      try {
        body = JSON.parse(body.toString('utf-8'));
      } catch (e) {
        body = {};
      }
    } else if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }

    const { userId, email, deviceId } = body || {};
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    await connectToDatabase();
    const user = await User.findOne({ clerkUserId: userId });

    const emailToCheck = email || (user && user.email);
    if (emailToCheck && !isCollegeEmail(emailToCheck)) {
      return res.status(403).json({
        error: 'Only college/university email addresses are permitted to purchase plays.'
      });
    }

    const MAX_ALLOWED_DEVICES = Number(process.env.MAX_ALLOWED_DEVICES || 2);
    if (user && deviceId && user.allowedDevices && user.allowedDevices.length >= MAX_ALLOWED_DEVICES) {
      const isKnown = user.allowedDevices.some(d => d.deviceId === deviceId);
      if (!isKnown) {
        return res.status(403).json({
          error: 'DEVICE_LIMIT_EXCEEDED',
          message: 'Unauthorized device: This account is restricted to 2 registered devices.'
        });
      }
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const priceINR = getPaidChancesPrice();
    const packChances = getPaidChancesPack();
    const amountInPaise = Math.round(priceINR * 100);
    const cleanUserId = userId.replace(/[^a-zA-Z0-9]/g, '');

    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `rcpt_${cleanUserId.slice(-8)}_${Date.now().toString().slice(-6)}`,
      notes: {
        userId,
        chances: String(packChances),
      },
    };

    const order = await razorpay.orders.create(options);

    return res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
      priceINR,
      packChances,
    });
  } catch (error) {
    console.error('Error in /api/create-order:', error);
    return res.status(500).json({ error: error.message || 'Error creating Razorpay order' });
  }
}
