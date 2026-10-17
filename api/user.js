import connectToDatabase from '../lib/db.js';
import User from '../lib/models/User.js';
import { isCollegeEmail } from '../lib/utils/emailValidator.js';
import { getFreeChancesPerGame, getPaidChancesPack, getPaidChancesPrice } from '../lib/utils/chanceConfig.js';

const SESSION_TIMEOUT_MS = Number(process.env.SESSION_TIMEOUT_MS || 60 * 1000);

export default async function handler(req, res) {
  // Set CORS headers
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

  try {
    await connectToDatabase();

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

    const userId = (req.query && req.query.userId) || (body && body.userId);
    const email = (body && body.email) || '';
    const name = (body && body.name) || '';
    const deviceId = (body && body.deviceId) || (req.query && req.query.deviceId);

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Verify college email
    if (email && !isCollegeEmail(email)) {
      return res.status(403).json({
        error: 'COLLEGE_EMAIL_REQUIRED',
        message: 'Access restricted to valid college/university email addresses.'
      });
    }

    let user = await User.findOne({ clerkUserId: userId });

    // Also verify existing user's email if stored
    if (user && user.email && !isCollegeEmail(user.email)) {
      return res.status(403).json({
        error: 'COLLEGE_EMAIL_REQUIRED',
        message: 'Access restricted to valid college/university email addresses.'
      });
    }

    if (user && email && user.email !== email) {
      user.email = email;
    }
    if (user && name && !user.name) {
      user.name = name;
    }

    const defaultFree = getFreeChancesPerGame();

    if (!user) {
      user = await User.create({
        clerkUserId: userId,
        email,
        name,
        activeSessionId: deviceId || null,
        activeSessionLastSeen: deviceId ? new Date() : null,
        allowedDevices: deviceId ? [{
          deviceId,
          registeredAt: new Date(),
          lastUsedAt: new Date(),
        }] : [],
        freeChances: {
          'path-finder': defaultFree,
          'bubble-sort': defaultFree,
          'tile-maze': defaultFree,
        },
        paidChances: {
          'path-finder': 0,
          'bubble-sort': 0,
          'tile-maze': 0,
        },
      });
    } else {
      // If user exists, make sure any missing game IDs have defaults
      let modified = false;
      const gameIds = ['path-finder', 'bubble-sort', 'tile-maze'];
      const getVal = (container, key) => {
        if (!container) return undefined;
        if (typeof container.get === 'function') return container.get(key);
        return container[key];
      };
      const setVal = (container, key, val) => {
        if (typeof container.set === 'function') container.set(key, val);
        else container[key] = val;
      };

      if (!user.freeChances) {
        user.freeChances = new Map();
        modified = true;
      }
      for (const gid of gameIds) {
        if (getVal(user.freeChances, gid) === undefined) {
          setVal(user.freeChances, gid, defaultFree);
          modified = true;
        }
      }
      if (user.paidChances) {
        for (const gid of gameIds) {
          if (getVal(user.paidChances, gid) === undefined) {
            setVal(user.paidChances, gid, 0);
            modified = true;
          }
        }
      } else {
        user.paidChances = new Map([
          ['path-finder', 0],
          ['bubble-sort', 0],
          ['tile-maze', 0],
        ]);
        modified = true;
      }
      if (email && user.email !== email) {
        user.email = email;
        modified = true;
      }
      if (name && user.name !== name) {
        user.name = name;
        modified = true;
      }
      if (modified) {
        user.markModified('freeChances');
        user.markModified('paidChances');
        await user.save();
      }
    }

    const toPlainObject = (container) => {
      if (!container) return {};
      if (typeof container.entries === 'function') {
        return Object.fromEntries(container.entries());
      }
      return { ...container };
    };

    const freeChancesObj = toPlainObject(user.freeChances);
    const paidChancesObj = toPlainObject(user.paidChances);

    const gameIdsList = ['path-finder', 'bubble-sort', 'tile-maze'];
    let totalChances = 0;
    for (const gid of gameIdsList) {
      if (freeChancesObj[gid] === undefined) freeChancesObj[gid] = defaultFree;
      if (paidChancesObj[gid] === undefined) paidChancesObj[gid] = 0;
      totalChances += (freeChancesObj[gid] || 0) + (paidChancesObj[gid] || 0);
    }

    return res.status(200).json({
      clerkUserId: user.clerkUserId,
      email: user.email,
      name: user.name,
      freeChances: freeChancesObj,
      paidChances: paidChancesObj,
      totalChances,
      config: {
        paidChancesPack: getPaidChancesPack(),
        paidChancesPrice: getPaidChancesPrice(),
        razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
      }
    });
  } catch (error) {
    console.error('Error in /api/user:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
