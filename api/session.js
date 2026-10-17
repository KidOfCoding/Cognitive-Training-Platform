import connectToDatabase from './db.js';
import User from './models/User.js';
import { isCollegeEmail } from './utils/emailValidator.js';
import { getFreeChancesPerGame } from './utils/chanceConfig.js';

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

  try {
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
    const deviceId = (req.query && req.query.deviceId) || (body && body.deviceId) || 'default-device';
    const email = (body && body.email) || (req.query && req.query.email) || '';

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Verify college email if email was provided
    if (email && !isCollegeEmail(email)) {
      return res.status(403).json({
        allowed: false,
        error: 'COLLEGE_EMAIL_REQUIRED',
        message: 'Only college/university email IDs are allowed to access this platform.'
      });
    }

    // Simple permissive session response (no device locks or concurrency blocks)
    return res.status(200).json({
      allowed: true,
      success: true,
      sessionId: deviceId,
    });
  } catch (error) {
    console.error('Error in /api/session:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
