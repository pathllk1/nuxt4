import mongoose, { Schema, Document } from 'mongoose';

export interface IGstinCache extends Document {
  gstin: string;
  rawData: any;
  tradeName: string;
  legalName: string;
  status: string;
  state: string;
  source: string;
  fetchedAt: Date;
  expiresAt: Date;
  fetchCount: number;
  lastAccessedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CACHE_TTL_DAYS = 90;

const gstinCacheSchema = new Schema(
  {
    gstin: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      index: true,
      trim: true,
    },
    rawData: {
      type: Schema.Types.Mixed,
      required: true,
    },
    tradeName: { type: String, default: '' },
    legalName: { type: String, default: '' },
    status: { type: String, default: '' },
    state: { type: String, default: '' },
    source: { type: String, default: 'rapidapi' },
    fetchedAt: { type: Date, default: Date.now },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
    fetchCount: { type: Number, default: 1 },
    lastAccessedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export { CACHE_TTL_DAYS };

export default (mongoose.models.GstinCache ||
  mongoose.model<IGstinCache>('GstinCache', gstinCacheSchema)) as mongoose.Model<IGstinCache>;
