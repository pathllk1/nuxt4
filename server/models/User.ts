import mongoose, { Schema, Document } from 'mongoose';
import Firm from './Firm';
import { hashPassword, verifyPassword } from '../utils/crypto-hash';

export interface IUserFirm {
  firm: mongoose.Types.ObjectId;
  grade: 'Owner' | 'Admin' | 'Manager' | 'Staff';
}

export interface ISecuritySettings {
  failedLoginAttempts: number;
  lastFailedLogin?: Date;
  accountLockedUntil?: Date;
  passwordChangedAt?: Date;
  trustedIPs: string[];
  suspiciousActivityCount: number;
  lastPasswordChange?: Date;
}

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: 'superadmin' | 'standard';
  status: 'pending' | 'active' | 'suspended';
  firms: IUserFirm[];
  securitySettings: ISecuritySettings;
  isAccountLocked: boolean;
  comparePassword(password: string): Promise<boolean>;
  incrementFailedLogins(): Promise<void>;
  resetFailedLogins(): Promise<void>;
  lockAccount(duration: number): Promise<void>;
}

const UserSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['superadmin', 'standard'], 
    default: 'standard' 
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'suspended'],
    default: 'pending',
    index: true
  },
  firms: [
    {
      firm: { type: Schema.Types.ObjectId, ref: Firm, required: true },
      grade: {
        type: String,
        enum: ['Owner', 'Admin', 'Manager', 'Staff'],
        default: 'Staff'
      }
    }
  ],
  securitySettings: {
    failedLoginAttempts: { type: Number, default: 0 },
    lastFailedLogin: { type: Date },
    accountLockedUntil: { type: Date },
    passwordChangedAt: { type: Date, default: Date.now },
    trustedIPs: [{ type: String }],
    suspiciousActivityCount: { type: Number, default: 0 },
    lastPasswordChange: { type: Date, default: Date.now }
  },
  isAccountLocked: { type: Boolean, default: false, index: true }
}, { timestamps: true });

// Hash password before saving using Argon2id WebAssembly
UserSchema.pre<IUser>('save', async function() {
  if (!this.isModified('password')) return;
  
  this.password = await hashPassword(this.password);
  
  if (this.isModified('password') && !this.isNew) {
    this.securitySettings.passwordChangedAt = new Date();
    this.securitySettings.lastPasswordChange = new Date();
  }
});

UserSchema.methods.comparePassword = async function(password: string): Promise<boolean> {
  try {
    return await verifyPassword(password, this.password);
  } catch (error) {
    return false;
  }
};

UserSchema.methods.incrementFailedLogins = async function(): Promise<void> {
  this.securitySettings.failedLoginAttempts += 1;
  this.securitySettings.lastFailedLogin = new Date();
  
  if (this.securitySettings.failedLoginAttempts >= 5) {
    await this.lockAccount(30); // Lock for 30 minutes
  }
  
  await this.save();
};

UserSchema.methods.resetFailedLogins = async function(): Promise<void> {
  this.securitySettings.failedLoginAttempts = 0;
  this.securitySettings.lastFailedLogin = undefined;
  await this.save();
};

UserSchema.methods.lockAccount = async function(durationMinutes: number): Promise<void> {
  this.isAccountLocked = true;
  this.securitySettings.accountLockedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
  await this.save();
};

// Virtual to check if account lock has expired
UserSchema.virtual('isLocked').get(function(this: IUser) {
  if (!this.isAccountLocked) return false;
  if (!this.securitySettings.accountLockedUntil) return false;
  
  if (this.securitySettings.accountLockedUntil < new Date()) {
    this.isAccountLocked = false;
    this.securitySettings.accountLockedUntil = undefined;
    this.save();
    return false;
  }
  
  return true;
});

// Avoid Mongoose Model compilation errors if hot-reloaded by Nitro/Next.js
export default (mongoose.models.User || mongoose.model<IUser>('User', UserSchema)) as mongoose.Model<IUser>;
