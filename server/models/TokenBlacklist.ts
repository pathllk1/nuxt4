import mongoose, { Schema, Document } from 'mongoose';

export interface ITokenBlacklist extends Document {
  token: string;
  tokenType: 'access' | 'refresh';
  userId: mongoose.Types.ObjectId;
  reason: string;
  expiresAt: Date;
}

const TokenBlacklistSchema: Schema = new Schema({
  token: { type: String, required: true, unique: true, index: true },
  tokenType: { type: String, enum: ['access', 'refresh'], required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reason: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } } // TTL index
}, { timestamps: true });

export default (mongoose.models.TokenBlacklist || mongoose.model<ITokenBlacklist>('TokenBlacklist', TokenBlacklistSchema)) as mongoose.Model<ITokenBlacklist>;
