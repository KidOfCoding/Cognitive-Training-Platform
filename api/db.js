import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';
dotenv.config();

// Ensure Node resolver reliably resolves MongoDB Atlas SRV and shard records
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export default async function connectToDatabase(req, res) {
  // If invoked directly as a Vercel serverless HTTP endpoint
  if (req && res && typeof res.status === 'function') {
    return res.status(404).json({ error: 'Endpoint not found' });
  }

  let uri = process.env.MONGODB_URI || process.env.MONGO_URL;
  try {
    const fs = await import('fs');
    if (fs.existsSync('.env')) {
      const parsed = dotenv.parse(fs.readFileSync('.env', 'utf-8'));
      if (parsed.MONGO_URL) uri = parsed.MONGO_URL;
      if (parsed.MONGODB_URI) uri = parsed.MONGODB_URI;
    }
  } catch (e) {}

  if (!uri) {
    throw new Error('Please define the MONGODB_URI or MONGO_URL environment variable inside project settings or .env');
  }

  // ReadyState 1 = connected, 2 = connecting
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (mongoose.connection.readyState !== 1 && mongoose.connection.readyState !== 2) {
    cached.conn = null;
    cached.promise = null;
  }

  if (!cached.promise) {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => {});
    }
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
      socketTimeoutMS: 30000,
    };

    cached.promise = mongoose.connect(uri, opts).then((mongooseInstance) => {
      return mongooseInstance;
    }).catch((err) => {
      cached.promise = null;
      console.error('[db.js] mongoose.connect failed:', err.message);
      cached.promise = null;
      throw err;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    cached.conn = null;
    throw e;
  }

  return cached.conn;
}
