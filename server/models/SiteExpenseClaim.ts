import mongoose, { Schema, Document } from 'mongoose';

export interface ISiteExpenseClaim extends Document {
  firmId: mongoose.Types.ObjectId;
  supervisorId: mongoose.Types.ObjectId;
  supervisorName: string;
  imprestAccountHead: string;

  expenseDate: string; // YYYY-MM-DD
  category: 'LABOUR' | 'MATERIAL' | 'WELFARE' | 'TRANSPORT' | 'FUEL' | 'REPAIRS' | 'OTHER';
  targetAccountHead: string;

  amount: number;
  paymentMode: 'CASH' | 'UPI' | 'NEFT';
  partyOrPayeeName?: string;
  narration: string;

  projectId?: string; // Optional job costing site tag
  status: 'PENDING' | 'APPROVED' | 'REJECTED';

  // Checker audit fields
  reviewedBy?: string;
  reviewedAt?: Date;
  rejectionReason?: string;
  generatedVoucherGroupId?: string; // Links to GL upon approval

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Category-to-COA default mapping for site expense quick-entry.
 * Supervisors select everyday construction terms; the system auto-maps
 * to the appropriate Chart of Accounts head for journal posting.
 */
export const SITE_EXPENSE_CATEGORY_MAP: Record<string, { accountName: string; accountType: string }> = {
  LABOUR: { accountName: 'Site Labour & Coolie Charges', accountType: 'DIRECT_EXPENSE' },
  WELFARE: { accountName: 'Staff & Labour Welfare', accountType: 'INDIRECT_EXPENSE' },
  MATERIAL: { accountName: 'Site Consumables & Local Purchases', accountType: 'DIRECT_EXPENSE' },
  TRANSPORT: { accountName: 'Freight & Cartage Inward', accountType: 'DIRECT_EXPENSE' },
  FUEL: { accountName: 'Generator & Machine Fuel', accountType: 'DIRECT_EXPENSE' },
  REPAIRS: { accountName: 'Machinery & Tools Maintenance', accountType: 'INDIRECT_EXPENSE' },
  OTHER: { accountName: 'Miscellaneous Site Expenses', accountType: 'INDIRECT_EXPENSE' },
};

const EXPENSE_CATEGORIES = ['LABOUR', 'MATERIAL', 'WELFARE', 'TRANSPORT', 'FUEL', 'REPAIRS', 'OTHER'];
const PAYMENT_MODES = ['CASH', 'UPI', 'NEFT'];
const CLAIM_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];

const SiteExpenseClaimSchema = new Schema<ISiteExpenseClaim>(
  {
    firmId: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
      index: true,
    },
    supervisorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    supervisorName: {
      type: String,
      required: true,
    },
    imprestAccountHead: {
      type: String,
      required: true,
    },
    expenseDate: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: EXPENSE_CATEGORIES,
      required: true,
    },
    targetAccountHead: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    paymentMode: {
      type: String,
      enum: PAYMENT_MODES,
      default: 'CASH',
    },
    partyOrPayeeName: {
      type: String,
      trim: true,
    },
    narration: {
      type: String,
      required: true,
      trim: true,
    },
    projectId: {
      type: String,
      index: true,
    },
    status: {
      type: String,
      enum: CLAIM_STATUSES,
      default: 'PENDING',
      index: true,
    },
    reviewedBy: {
      type: String,
    },
    reviewedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
    },
    generatedVoucherGroupId: {
      type: String,
      index: true,
    },
  },
  { timestamps: true }
);

// Composite indexes for common query patterns
SiteExpenseClaimSchema.index({ firmId: 1, status: 1 });
SiteExpenseClaimSchema.index({ firmId: 1, supervisorId: 1, status: 1 });
SiteExpenseClaimSchema.index({ firmId: 1, expenseDate: 1 });

export default (mongoose.models.SiteExpenseClaim as mongoose.Model<ISiteExpenseClaim>) ||
  mongoose.model<ISiteExpenseClaim>('SiteExpenseClaim', SiteExpenseClaimSchema);
