import mongoose, { Schema, Document } from 'mongoose';

// ─────────────────────────────────────────────────────────────────────────
// PeriodLock Model
//
// Stores fiscal period freeze dates per firm. Once a lock date is set,
// no voucher with transactionDate <= lockDate can be created, edited,
// or deleted through the UnifiedPostingService.
//
// Only an admin with explicit unlock override can temporarily relax the lock.
// ─────────────────────────────────────────────────────────────────────────

export interface IPeriodLock extends Document {
  firmId: mongoose.Types.ObjectId;

  /** The latest date that is frozen. Vouchers dated on or before this are read-only. */
  lockDate: string; // YYYY-MM-DD

  /** Financial year this lock applies to (e.g. '2025-26') */
  financialYear: string;

  /** Reason for locking (e.g. 'GST Q3 Return Filed', 'Audit Complete') */
  reason: string;

  /** Username of the person who set the lock */
  lockedBy: string;

  /** Whether this lock is currently active */
  isActive: boolean;

  /**
   * Year-end closing status for this financial year:
   * - NOT_CLOSED: FY is open, no closing has been performed
   * - IN_PROGRESS: Closing is currently executing (prevents double-execution)
   * - CLOSED: FY has been fully closed, P&L swept, OBs rolled forward
   */
  closingStatus: 'NOT_CLOSED' | 'IN_PROGRESS' | 'CLOSED';

  /** Timestamp when the year-end close was executed (null if not closed) */
  closedAt?: Date | null;

  /** Username of the person who executed the year-end close */
  closedBy?: string | null;

  createdAt: Date;
  updatedAt: Date;
}

const PeriodLockSchema = new Schema<IPeriodLock>(
  {
    firmId: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
      index: true,
    },
    lockDate: {
      type: String,
      required: true,
    },
    financialYear: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
      default: '',
    },
    lockedBy: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    closingStatus: {
      type: String,
      enum: ['NOT_CLOSED', 'IN_PROGRESS', 'CLOSED'],
      default: 'NOT_CLOSED',
    },
    closedAt: {
      type: Date,
      default: null,
    },
    closedBy: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// One active lock per firm per financial year
PeriodLockSchema.index({ firmId: 1, financialYear: 1 }, { unique: true });

// Fast lookup: find the latest active lock for a firm
PeriodLockSchema.index({ firmId: 1, isActive: 1, lockDate: -1 });

export default (mongoose.models.PeriodLock as mongoose.Model<IPeriodLock>) ||
  mongoose.model<IPeriodLock>('PeriodLock', PeriodLockSchema);
