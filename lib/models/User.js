import mongoose from 'mongoose';
import { getFreeChancesPerGame } from '../utils/chanceConfig.js';

const userSchema = new mongoose.Schema({
  clerkUserId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  email: {
    type: String,
    default: '',
  },
  name: {
    type: String,
    default: '',
  },
  freeChances: {
    type: Map,
    of: Number,
    default: () => ({
      'path-finder': getFreeChancesPerGame(),
      'bubble-sort': getFreeChancesPerGame(),
      'tile-maze': getFreeChancesPerGame(),
    }),
  },
  paidChances: {
    type: Map,
    of: Number,
    default: () => ({
      'path-finder': 0,
      'bubble-sort': 0,
      'tile-maze': 0,
    }),
  },
  payments: [
    {
      orderId: String,
      paymentId: String,
      amount: Number,
      currency: { type: String, default: 'INR' },
      createdAt: { type: Date, default: Date.now },
    },
  ],
  activeSessionId: {
    type: String,
    default: null,
  },
  activeSessionLastSeen: {
    type: Date,
    default: null,
  },
  activeDeviceInfo: {
    type: String,
    default: '',
  },
  allowedDevices: [
    {
      deviceId: { type: String, required: true },
      deviceInfo: { type: String, default: '' },
      registeredAt: { type: Date, default: Date.now },
      lastUsedAt: { type: Date, default: Date.now },
    },
  ],
}, {
  timestamps: true,
});

export default mongoose.models.User || mongoose.model('User', userSchema);
