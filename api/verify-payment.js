import crypto from 'crypto';
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
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
    if (!keySecret) {
      return res.status(500).json({ error: 'Razorpay secret key not configured' });
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

    // Dev / Test simulation mode for when Razorpay CDN is unreachable or blocked
    if (body && body.isDevSimulation) {
      if (!body.userId) {
        return res.status(400).json({ error: 'userId is required' });
      }
      await connectToDatabase();
      const user = await User.findOne({ clerkUserId: body.userId });
      if (!user) {
        return res.status(404).json({ error: 'User not found in database' });
      }
      const packChances = getPaidChancesPack();
      const priceINR = getPaidChancesPrice();
      const gameIds = ['path-finder', 'bubble-sort', 'tile-maze'];

      if (!user.paidChances || typeof user.paidChances.get !== 'function') {
        const initialVal = typeof user.paidChances === 'number' ? user.paidChances : 0;
        user.paidChances = new Map([
          ['path-finder', initialVal],
          ['bubble-sort', initialVal],
          ['tile-maze', initialVal]
        ]);
      }

      for (const gid of gameIds) {
        const current = Number(user.paidChances.get(gid)) || 0;
        user.paidChances.set(gid, current + packChances);
      }
      user.markModified('paidChances');

      if (!user.payments) user.payments = [];
      user.payments.push({
        orderId: `sim_order_${Date.now()}`,
        paymentId: `sim_pay_${Date.now()}`,
        amount: priceINR,
        currency: 'INR',
        createdAt: new Date(),
      });
      await user.save();

      const toPlainObject = (container) => {
        if (!container) return {};
        if (typeof container.entries === 'function') {
          return Object.fromEntries(container.entries());
        }
        return { ...container };
      };

      const paidChancesObj = toPlainObject(user.paidChances);
      const freeChancesObj = toPlainObject(user.freeChances);

      return res.status(200).json({
        success: true,
        paidChances: paidChancesObj,
        freeChances: freeChancesObj,
        credited: packChances,
        message: `Simulated Recharge: Successfully added ${packChances} plays!`,
      });
    }

    const {
      userId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body || {};

    if (!userId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment verification details' });
    }

    // Verify HMAC SHA256 Signature using timingSafeEqual
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const isSignatureValid = expectedSignature.length === razorpay_signature.length &&
      crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'utf-8'),
        Buffer.from(razorpay_signature, 'utf-8')
      );

    if (!isSignatureValid) {
      return res.status(400).json({ success: false, error: 'Payment signature verification failed' });
    }

    await connectToDatabase();

    const user = await User.findOne({ clerkUserId: userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found in database' });
    }

    if (user.email && !isCollegeEmail(user.email)) {
      return res.status(403).json({ success: false, error: 'Access restricted to valid college/university email addresses.' });
    }

    // Prevent duplicate crediting for same paymentId
    const alreadyProcessed = user.payments && user.payments.some(p => p.paymentId === razorpay_payment_id);
    const packCount = getPaidChancesPack();
    const priceINR = getPaidChancesPrice();

    const gameIds = ['path-finder', 'bubble-sort', 'tile-maze'];

    const toPlainObject = (container) => {
      if (!container) return {};
      if (typeof container.entries === 'function') {
        return Object.fromEntries(container.entries());
      }
      return { ...container };
    };

    const getVal = (container, key) => {
      if (!container) return 0;
      if (typeof container.get === 'function') return Number(container.get(key)) || 0;
      return Number(container[key]) || 0;
    };

    const setVal = (container, key, val) => {
      if (typeof container.set === 'function') {
        container.set(key, val);
      } else {
        container[key] = val;
      }
    };

    if (!alreadyProcessed) {
      if (!user.paidChances) {
        user.paidChances = new Map();
      }

      for (const gid of gameIds) {
        const cur = getVal(user.paidChances, gid);
        setVal(user.paidChances, gid, cur + packCount);
      }
      user.markModified('paidChances');

      if (!user.payments) user.payments = [];
      user.payments.push({
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        amount: priceINR,
        currency: 'INR',
        createdAt: new Date(),
      });
      await user.save();
    }

    const freeChancesObj = toPlainObject(user.freeChances);
    const paidChancesObj = toPlainObject(user.paidChances);

    let totalChances = 0;
    for (const gid of gameIds) {
      if (freeChancesObj[gid] === undefined) freeChancesObj[gid] = 0;
      if (paidChancesObj[gid] === undefined) paidChancesObj[gid] = 0;
      totalChances += (freeChancesObj[gid] || 0) + (paidChancesObj[gid] || 0);
    }

    return res.status(200).json({
      success: true,
      message: `${packCount} chances added for all assessments!`,
      paidChances: paidChancesObj,
      freeChances: freeChancesObj,
      totalChances,
    });
  } catch (error) {
    console.error('Error in /api/verify-payment:', error);
    return res.status(500).json({ error: error.message || 'Payment verification failed' });
  }
}
