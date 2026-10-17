import connectToDatabase from './db.js';
import User from './models/User.js';
import { isCollegeEmail } from './utils/emailValidator.js';

const SESSION_TIMEOUT_MS = Number(process.env.SESSION_TIMEOUT_MS || 60 * 1000);

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

    const { userId, gameId, deviceId } = body || {};

    if (!userId || !gameId) {
      return res.status(400).json({ error: 'userId and gameId are required' });
    }

    const user = await User.findOne({ clerkUserId: userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check college email validity
    if (user.email && !isCollegeEmail(user.email)) {
      return res.status(403).json({
        allowed: false,
        error: 'COLLEGE_EMAIL_REQUIRED',
        message: 'Access restricted to valid college/university email addresses.'
      });
    }

    const toPlainObject = (container) => {
      if (!container) return {};
      if (typeof container.entries === 'function') {
        return Object.fromEntries(container.entries());
      }
      return { ...container };
    };

    const gameIds = ['path-finder', 'bubble-sort', 'tile-maze'];

    // Normalize freeChances and paidChances if stored as primitives or plain objects
    if (!user.freeChances || typeof user.freeChances.get !== 'function') {
      const defaultFree = typeof user.freeChances === 'number' ? user.freeChances : 1;
      const initialMap = new Map();
      for (const gid of gameIds) {
        initialMap.set(gid, (user.freeChances && user.freeChances[gid] !== undefined) ? Number(user.freeChances[gid]) : defaultFree);
      }
      user.freeChances = initialMap;
    }

    if (!user.paidChances || typeof user.paidChances.get !== 'function') {
      const defaultPaid = typeof user.paidChances === 'number' ? user.paidChances : 0;
      const initialMap = new Map();
      for (const gid of gameIds) {
        initialMap.set(gid, (user.paidChances && user.paidChances[gid] !== undefined) ? Number(user.paidChances[gid]) : defaultPaid);
      }
      user.paidChances = initialMap;
    }

    const freeCount = Number(user.freeChances.get(gameId)) || 0;
    const paidCount = Number(user.paidChances.get(gameId)) || 0;

    let usedType = null;

    if (freeCount > 0) {
      user.freeChances.set(gameId, freeCount - 1);
      user.markModified('freeChances');
      usedType = 'free';
    } else if (paidCount > 0) {
      user.paidChances.set(gameId, paidCount - 1);
      user.markModified('paidChances');
      usedType = 'paid';
    } else {
      const freeChancesObj = toPlainObject(user.freeChances);
      const paidChancesObj = toPlainObject(user.paidChances);

      return res.status(403).json({
        allowed: false,
        message: 'No plays remaining for this assessment. Please recharge to continue.',
        freeChances: freeChancesObj,
        paidChances: paidChancesObj,
      });
    }

    await user.save();

    const freeChancesObj = toPlainObject(user.freeChances);
    const paidChancesObj = toPlainObject(user.paidChances);

    let totalChances = 0;
    for (const gid of ['path-finder', 'bubble-sort', 'tile-maze']) {
      totalChances += (freeChancesObj[gid] || 0) + (paidChancesObj[gid] || 0);
    }

    return res.status(200).json({
      allowed: true,
      usedType,
      gameId,
      freeChances: freeChancesObj,
      paidChances: paidChancesObj,
      totalChances,
    });
  } catch (error) {
    console.error('Error in /api/play:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
