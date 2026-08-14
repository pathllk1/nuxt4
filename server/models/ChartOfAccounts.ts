import mongoose, { Schema, Document } from 'mongoose';

export interface IChartOfAccounts extends Document {
  firm_id: mongoose.Types.ObjectId;
  account_name: string;
  account_type: string;
  pan?: string | null;
  aadhaar_number?: string | null;
  gstin?: string | null;
  phone?: string | null;
  is_system: boolean;
  is_active: boolean;
  created_by?: mongoose.Types.ObjectId | null;
  updated_by?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const chartOfAccountsSchema = new Schema<IChartOfAccounts>(
  {
    firm_id: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
      index: true,
    },
    account_name: {
      type: String,
      required: true,
      trim: true,
    },
    account_type: {
      type: String,
      required: true,
    },
    pan: {
      type: String,
      default: null,
      trim: true,
      uppercase: true,
    },
    aadhaar_number: {
      type: String,
      default: null,
      trim: true,
    },
    gstin: {
      type: String,
      default: null,
      trim: true,
      uppercase: true,
    },
    phone: {
      type: String,
      default: null,
      trim: true,
    },
    is_system: {
      type: Boolean,
      default: false,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    created_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updated_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

chartOfAccountsSchema.index({ firm_id: 1, account_name: 1 }, { unique: true });

export default (mongoose.models.ChartOfAccounts as mongoose.Model<IChartOfAccounts>) || mongoose.model<IChartOfAccounts>('ChartOfAccounts', chartOfAccountsSchema);
