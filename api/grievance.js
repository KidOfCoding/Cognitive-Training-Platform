import connectToDatabase from '../lib/db.js';
import Grievance from '../lib/models/Grievance.js';
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
dotenv.config();

// Configure Cloudinary if credentials exist
const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY || process.env.VITE_CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET || process.env.VITE_CLOUDINARY_API_SECRET;
const cloudinaryUrl = process.env.CLOUDINARY_URL;

if (cloudinaryUrl || (cloudName && apiKey && apiSecret)) {
  if (cloudinaryUrl) {
    cloudinary.config({ cloudinary_url: cloudinaryUrl });
  } else {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
  }
}

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

    // GET /api/grievance (List grievances for admin or user)
    if (req.method === 'GET') {
      const { category, email, status } = req.query || {};
      const filter = {};
      if (category) filter.category = category;
      if (email) filter.email = String(email).trim().toLowerCase();
      if (status) filter.status = status;

      const grievances = await Grievance.find(filter).sort({ createdAt: -1 }).limit(300);
      return res.status(200).json({ success: true, grievances });
    }

    // POST /api/grievance (Submit refund request, bug report, or suggestion)
    if (req.method === 'POST') {
      let body = req.body;
      if (Buffer.isBuffer(body)) {
        try { body = JSON.parse(body.toString('utf-8')); } catch { body = {}; }
      } else if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }

      const { email, userId, category, subject, description, photoBase64, photoUrl } = body || {};

      if (!email || !description || !subject) {
        return res.status(400).json({ error: 'Email, subject, and description are required.' });
      }

      const validCategories = ['refund_irrelevant', 'bug_issue', 'suggestion'];
      const chosenCategory = validCategories.includes(category) ? category : 'refund_irrelevant';

      let finalPhotoUrl = photoUrl || '';

      // Upload to Cloudinary if photoBase64 is provided
      if (photoBase64) {
        try {
          if (cloudName && apiKey && apiSecret) {
            const uploadRes = await cloudinary.uploader.upload(photoBase64, {
              folder: 'cognitive_grievances',
              resource_type: 'image',
            });
            finalPhotoUrl = uploadRes.secure_url || uploadRes.url || '';
          } else {
            // Cloudinary credentials not yet configured in .env - store the image safely
            finalPhotoUrl = photoBase64.length < 500000 ? photoBase64 : '';
          }
        } catch (uploadErr) {
          console.warn('Cloudinary upload warning:', uploadErr.message);
          // If upload fails, keep whatever URL or preview available
          if (!finalPhotoUrl && photoBase64.length < 500000) {
            finalPhotoUrl = photoBase64;
          }
        }
      }

      const grievance = await Grievance.create({
        email: String(email).trim().toLowerCase(),
        userId: userId || '',
        category: chosenCategory,
        subject: String(subject).trim(),
        description: String(description).trim(),
        photoUrl: finalPhotoUrl,
        status: 'pending',
      });

      return res.status(201).json({
        success: true,
        message: 'Grievance / Refund request received. Our team will review your proof within 24-48 hours.',
        grievance,
      });
    }

    // PATCH /api/grievance (Update status e.g. approved / refunded by admin)
    if (req.method === 'PATCH') {
      let body = req.body;
      if (Buffer.isBuffer(body)) {
        try { body = JSON.parse(body.toString('utf-8')); } catch { body = {}; }
      } else if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }

      const { id, status, adminNotes } = body || {};
      if (!id) {
        return res.status(400).json({ error: 'Grievance id is required' });
      }

      const updated = await Grievance.findByIdAndUpdate(
        id,
        {
          ...(status && { status }),
          ...(adminNotes !== undefined && { adminNotes }),
        },
        { new: true }
      );

      return res.status(200).json({ success: true, grievance: updated });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in /api/grievance:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
