import mongoose, { Schema, Document } from 'mongoose';

// ─────────────────────────────────────────────────────────────────────────
// PostingBarrier Model (F-01)
//
// Distributed in-flight writer barrier tracking active ledger postings
// across multi-instance server deployments. Year-end close workers check
// this collection to ensure all in-flight postings have drained before
// calculating trial-balance snapshots.
// ─────────────────────────────────────────────────────────────────────────

export interface IPostingBarrier extends Document {
  firmId: string;
  financialYear: string;
  postingId: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PostingBarrierSchema = new Schema<IPostingBarrier>(
  {
    firmId: {
      type: String,
      required: true,
      index: true,
    },
    financialYear: {
      type: String,
      required: true,
      index: true,
    },
    postingId: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB TTL auto-cleanup after 60s
    },
  },
  { timestamps: true }
);

PostingBarrierSchema.index({ firmId: 1, financialYear: 1, expiresAt: 1 });

export default (mongoose.models.PostingBarrier as mongoose.Model<IPostingBarrier>) ||
  mongoose.model<IPostingBarrier>('PostingBarrier', PostingBarrierSchema);

