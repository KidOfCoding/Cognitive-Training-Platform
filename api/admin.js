import connectToDatabase from '../lib/db.js';
import User from '../lib/models/User.js';
import Grievance from '../lib/models/Grievance.js';
import CollegeRequest from '../lib/models/CollegeRequest.js';
import dotenv from 'dotenv';
dotenv.config();

const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || 'admin@cognitive2026').trim();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-admin-password'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (Buffer.isBuffer(body)) {
      try { body = JSON.parse(body.toString('utf-8')); } catch { body = {}; }
    } else if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }

    const providedPassword = (body && body.password) || req.headers['x-admin-password'] || '';

    if (!providedPassword || String(providedPassword).trim() !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    await connectToDatabase();

    // 1. Fetch Users and Payments
    const rawUsers = await User.find({}).sort({ _id: -1 }).lean();
    let totalRevenue = 0;
    let totalPaymentsCount = 0;

    const users = rawUsers.map((u) => {
      let userTotalPaid = 0;
      const paymentHistory = Array.isArray(u.payments) ? u.payments : [];

      for (const p of paymentHistory) {
        const amt = Number(p.amount) || 0;
        userTotalPaid += amt;
        totalRevenue += amt;
        totalPaymentsCount++;
      }

      const toPlain = (val) => {
        if (!val) return {};
        if (typeof val.entries === 'function') return Object.fromEntries(val.entries());
        return { ...val };
      };

      return {
        id: u._id,
        clerkUserId: u.clerkUserId,
        email: u.email || 'N/A',
        name: u.name || '',
        totalPaid: userTotalPaid,
        payments: paymentHistory,
        freeChances: toPlain(u.freeChances),
        paidChances: toPlain(u.paidChances),
        deviceCount: Array.isArray(u.allowedDevices) ? u.allowedDevices.length : 0,
        activeDeviceInfo: u.activeDeviceInfo || '',
        lastSeen: u.activeSessionLastSeen || null,
      };
    });

    // 2. Fetch Grievances & Refund Requests
    const grievances = await Grievance.find({}).sort({ createdAt: -1 }).lean();

    // 3. Fetch College Addition Requests
    const collegeRequests = await CollegeRequest.find({}).sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      authenticated: true,
      stats: {
        totalRevenue,
        totalUsers: users.length,
        totalPaymentsCount,
        totalGrievances: grievances.length,
        totalCollegeRequests: collegeRequests.length,
        pendingRefunds: grievances.filter(g => g.category === 'refund_irrelevant' && g.status === 'pending').length,
      },
      users,
      grievances,
      collegeRequests,
    });
  } catch (error) {
    console.error('Error in /api/admin:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
