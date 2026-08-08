import mongoose, { Schema, Document } from 'mongoose';

export interface ISecurityLog extends Document {
  userId?: mongoose.Types.ObjectId;
  email?: string;
  action: 'login_success' | 'login_failed' | 'logout' | 'token_refresh' | 'token_revoked' | 
          'password_change' | 'suspicious_activity' | 'rate_limit_exceeded' | 'invalid_token' |
          'session_created' | 'session_terminated' | 'anomaly_detected';
  ipAddress: string;
  userAgent: string;
  deviceFingerprint?: string;
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
  metadata?: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
}

const SecurityLogSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  email: { type: String },
  action: { 
    type: String, 
    required: true,
    enum: ['login_success', 'login_failed', 'logout', 'token_refresh', 'token_revoked',
           'password_change', 'suspicious_activity', 'rate_limit_exceeded', 'invalid_token',
           'session_created', 'session_terminated', 'anomaly_detected', 'signup', 'signup_failed']
  },
  ipAddress: { type: String, required: true, index: true },
  userAgent: { type: String, required: true },
  deviceFingerprint: { type: String, index: true },
  location: {
    country: String,
    region: String,
    city: String
  },
  metadata: { type: Schema.Types.Mixed },
  severity: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low',
    index: true
  },
  timestamp: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

SecurityLogSchema.index({ userId: 1, timestamp: -1 });
SecurityLogSchema.index({ action: 1, timestamp: -1 });
SecurityLogSchema.index({ severity: 1, timestamp: -1 });

export default (mongoose.models.SecurityLog || mongoose.model<ISecurityLog>('SecurityLog', SecurityLogSchema)) as mongoose.Model<ISecurityLog>;
