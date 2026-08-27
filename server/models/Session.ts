import mongoose, { Schema, Document } from 'mongoose';

export interface ISession extends Document {
  userId: mongoose.Types.ObjectId;
  refreshToken: string;
  previousRefreshToken?: string;
  previousRotatedAt?: Date;
  lastRefreshAttempt?: Date;
  refreshLockedUntil?: Date;
  deviceFingerprint: string;
  ipAddress: string;
  userAgent: string;
  deviceInfo: {
    browser?: string;
    os?: string;
    device?: string;
  };
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
  isActive: boolean;
  lastActivity: Date;
  expiresAt: Date;
  createdAt: Date;
  revokedAt?: Date;
  revokedReason?: string;
}

const SessionSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  refreshToken: { type: String, required: true, unique: true, index: true },
  previousRefreshToken: { type: String, index: true },
  previousRotatedAt: { type: Date },
  lastRefreshAttempt: { type: Date },
  refreshLockedUntil: { type: Date },
  deviceFingerprint: { type: String, required: true, index: true },
  ipAddress: { type: String, required: true },
  userAgent: { type: String, required: true },
  deviceInfo: {
    browser: String,
    os: String,
    device: String
  },
  location: {
    country: String,
    region: String,
    city: String
  },
  isActive: { type: Boolean, default: true, index: true },
  lastActivity: { type: Date, default: Date.now, index: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }, // TTL index
  revokedAt: { type: Date },
  revokedReason: { type: String }
}, { timestamps: true });

SessionSchema.index({ userId: 1, isActive: 1 });
SessionSchema.index({ userId: 1, deviceFingerprint: 1 });

export default (mongoose.models.Session || mongoose.model<ISession>('Session', SessionSchema)) as mongoose.Model<ISession>;
