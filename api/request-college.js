import connectToDatabase from '../lib/db.js';
import CollegeRequest from '../lib/models/CollegeRequest.js';

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

    if (req.method === 'GET') {
      const requests = await CollegeRequest.find({}).sort({ createdAt: -1 }).limit(200);
      return res.status(200).json({ success: true, requests });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (Buffer.isBuffer(body)) {
        try { body = JSON.parse(body.toString('utf-8')); } catch { body = {}; }
      } else if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }

      const { collegeName, email, domain, notes } = body || {};

      if (!collegeName || !email) {
        return res.status(400).json({ error: 'College name and user email are required.' });
      }

      const cleanEmail = String(email).trim().toLowerCase();
      const cleanCollege = String(collegeName).trim();
      const derivedDomain = domain || cleanEmail.split('@')[1] || '';

      const doc = await CollegeRequest.create({
        email: cleanEmail,
        collegeName: cleanCollege,
        domain: derivedDomain,
        notes: notes || '',
        status: 'pending',
      });

      return res.status(201).json({
        success: true,
        message: 'College request submitted successfully.',
        request: doc,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in /api/request-college:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
