import connectToDatabase from './db.js';
import User from './models/User.js';
import { isCollegeEmail } from './utils/emailValidator.js';
import { getFreeChancesPerGame } from './utils/chanceConfig.js';

// Inactivity threshold in milliseconds (default: 60 seconds)
const SESSION_TIMEOUT_MS = Number(process.env.SESSION_TIMEOUT_MS || 60 * 1000);
const MAX_ALLOWED_DEVICES = Number(process.env.MAX_ALLOWED_DEVICES || 2);

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
    const deviceId = (req.query && req.query.deviceId) || (body && body.deviceId);
    const action = (body && body.action) || (req.query && req.query.action) || 'claim';
    const email = (body && body.email) || (req.query && req.query.email) || '';
    const deviceInfo = (body && body.deviceInfo) || '';
    const replaceDeviceId = (body && body.replaceDeviceId) || '';

    if (!userId || !deviceId) {
      return res.status(400).json({ error: 'userId and deviceId are required' });
    }

    // Verify college email if email was provided
    if (email && !isCollegeEmail(email)) {
      return res.status(403).json({
        allowed: false,
        error: 'COLLEGE_EMAIL_REQUIRED',
        message: 'Only college/university email IDs are allowed to access this platform.'
      });
    }

    let user = await User.findOne({ clerkUserId: userId });
    const now = Date.now();

    if (!user) {
      if (action === 'release') {
        return res.status(200).json({ success: true });
      }

      // If user doesn't exist yet, create initial record with this device registered as Device #1
      const defaultFree = getFreeChancesPerGame();
      user = await User.create({
        clerkUserId: userId,
        email,
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
        activeSessionId: deviceId,
        activeSessionLastSeen: new Date(),
        activeDeviceInfo: deviceInfo,
        allowedDevices: [
          {
            deviceId,
            deviceInfo: deviceInfo || '',
            registeredAt: new Date(),
            lastUsedAt: new Date(),
          }
        ],
      });

      return res.status(200).json({
        allowed: true,
        sessionId: deviceId,
        deviceSlot: 1,
        totalDevices: 1,
      });
    }

    // Double check email if user exists in DB
    if (user.email && !isCollegeEmail(user.email)) {
      return res.status(403).json({
        allowed: false,
        error: 'COLLEGE_EMAIL_REQUIRED',
        message: 'Only college/university email IDs are allowed to access this platform.'
      });
    }

    // Handle session release
    if (action === 'release') {
      if (user.activeSessionId === deviceId) {
        user.activeSessionId = null;
        user.activeSessionLastSeen = null;
        await user.save();
      }
      return res.status(200).json({ success: true, released: true });
    }

    if (!user.allowedDevices) {
      user.allowedDevices = [];
    }

    // --- ACTION: RESET REGISTERED DEVICES ---
    if (action === 'reset-devices') {
      user.allowedDevices = [{
        deviceId,
        deviceInfo: deviceInfo || '',
        registeredAt: new Date(),
        lastUsedAt: new Date(),
      }];
      user.activeSessionId = deviceId;
      user.activeSessionLastSeen = new Date();
      if (deviceInfo) user.activeDeviceInfo = deviceInfo;
      if (email && user.email !== email) user.email = email;
      await user.save();

      return res.status(200).json({
        allowed: true,
        sessionId: deviceId,
        deviceSlot: 1,
        totalDevices: 1,
        message: 'Registered devices reset successfully. This device is authorized.',
      });
    }

    // Check if device is in registered list
    const existingDeviceIndex = user.allowedDevices.findIndex(d => d.deviceId === deviceId);

    if (existingDeviceIndex !== -1) {
      // Device is authorized! Update last used timestamp and info
      user.allowedDevices[existingDeviceIndex].lastUsedAt = new Date();
      if (deviceInfo) {
        user.allowedDevices[existingDeviceIndex].deviceInfo = deviceInfo;
      }
    } else {
      // Device is NOT in the registered list
      if (user.allowedDevices.length >= MAX_ALLOWED_DEVICES) {
        // Strictly block any 3rd device
        return res.status(403).json({
          allowed: false,
          error: 'DEVICE_LIMIT_EXCEEDED',
          message: `This account has reached its strict limit of ${MAX_ALLOWED_DEVICES} registered devices. Access from unauthorized devices is blocked.`,
          allowedDevices: user.allowedDevices,
          allowedDevicesCount: user.allowedDevices.length,
          maxDevices: MAX_ALLOWED_DEVICES,
        });
      }

      // User has fewer than MAX_ALLOWED_DEVICES: register this new device!
      user.allowedDevices.push({
        deviceId,
        deviceInfo: deviceInfo || '',
        registeredAt: new Date(),
        lastUsedAt: new Date(),
      });
    }

    // --- ACTION: TAKEOVER (Switch Session / "Continue here?") ---
    if (action === 'takeover') {
      // Device is verified as authorized. Transfer active session directly!
      user.activeSessionId = deviceId;
      user.activeSessionLastSeen = new Date();
      if (deviceInfo) user.activeDeviceInfo = deviceInfo;
      if (email && user.email !== email) user.email = email;
      await user.save();

      return res.status(200).json({
        allowed: true,
        sessionId: deviceId,
        message: 'Active session transferred to this device.',
        deviceSlot: user.allowedDevices.findIndex(d => d.deviceId === deviceId) + 1,
        totalDevices: user.allowedDevices.length,
      });
    }

    // --- ENFORCE CONCURRENT SESSION LOCK (Only 1 device active at a time) ---
    const isSessionExpired = !user.activeSessionLastSeen ||
      (now - new Date(user.activeSessionLastSeen).getTime() > SESSION_TIMEOUT_MS);

    const isOtherSessionActive = Boolean(
      user.activeSessionId &&
      user.activeSessionId !== deviceId &&
      !isSessionExpired
    );

    if (action === 'claim') {
      if (isOtherSessionActive) {
        const msSinceLastSeen = now - new Date(user.activeSessionLastSeen).getTime();
        const secondsRemaining = Math.max(1, Math.ceil((SESSION_TIMEOUT_MS - msSinceLastSeen) / 1000));
        return res.status(409).json({
          allowed: false,
          error: 'ACTIVE_SESSION_EXISTS',
          message: 'This account is currently active on another device.',
          otherDeviceInfo: user.activeDeviceInfo || 'Another Device',
          lastActive: user.activeSessionLastSeen,
          secondsRemaining,
        });
      }

      // Claim session for this device
      user.activeSessionId = deviceId;
      user.activeSessionLastSeen = new Date();
      if (deviceInfo) user.activeDeviceInfo = deviceInfo;
      if (email && user.email !== email) user.email = email;
      await user.save();

      return res.status(200).json({
        allowed: true,
        sessionId: deviceId,
        deviceSlot: user.allowedDevices.findIndex(d => d.deviceId === deviceId) + 1,
        totalDevices: user.allowedDevices.length,
      });
    }

    if (action === 'heartbeat') {
      if (user.activeSessionId === deviceId) {
        user.activeSessionLastSeen = new Date();
        await user.save();
        return res.status(200).json({ allowed: true });
      }

      if (isOtherSessionActive) {
        return res.status(409).json({
          allowed: false,
          error: 'ACTIVE_SESSION_EXISTS',
          message: 'Session transferred to another device.',
        });
      }

      // If previous session timed out, re-claim for this device
      user.activeSessionId = deviceId;
      user.activeSessionLastSeen = new Date();
      await user.save();
      return res.status(200).json({ allowed: true });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('Error in /api/session:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
