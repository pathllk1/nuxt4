import mongoose, { Schema, Document } from 'mongoose';

export interface IWage extends Document {
  firm_id: mongoose.Types.ObjectId;
  master_roll_id: mongoose.Types.ObjectId;
  p_day_wage?: number;
  wage_days: number;
  project?: string;
  site?: string;
  gross_salary: number;
  epf_deduction: number;
  esic_deduction: number;
  other_deduction: number;
  other_benefit: number;
  advance_deduction: number;
  net_salary: number;
  remarks?: string;
  salary_month: string;
  paid_date?: string;
  cheque_no?: string;
  bank_account_id: mongoose.Types.ObjectId | null;
  payment_mode: 'CASH' | 'CHEQUE' | 'NEFT' | 'RTGS' | 'IMPS' | 'UPI' | null;
  status: 'DRAFT' | 'POSTED' | 'LOCKED';
  voucher_group_id?: string | null;
  posted_date?: Date | null;
  posted_by?: mongoose.Types.ObjectId | null;
  created_by: mongoose.Types.ObjectId;
  updated_by: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const wageSchema = new Schema<IWage>(
  {
    firm_id: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
      index: true,
    },
    master_roll_id: {
      type: Schema.Types.ObjectId,
      ref: 'MasterRoll',
      required: true,
      index: true,
    },
    p_day_wage:       { type: Number },
    wage_days:        { type: Number, default: 26 },
    project:          { type: String },
    site:             { type: String },
    gross_salary:     { type: Number, required: true },
    epf_deduction:    { type: Number, default: 0 },
    esic_deduction:   { type: Number, default: 0 },
    other_deduction:  { type: Number, default: 0 },
    other_benefit:    { type: Number, default: 0 },
    advance_deduction: { type: Number, default: 0 },
    net_salary:       { type: Number, required: true },
    remarks:          { type: String },
    salary_month:     { type: String, required: true },
    paid_date:        { type: String },
    cheque_no:        { type: String },
    
    bank_account_id: {
      type: Schema.Types.ObjectId,
      ref: 'BankAccount',
      default: null,
      index: true,
    },
    payment_mode: {
      type: String,
      enum: ['CASH', 'CHEQUE', 'NEFT', 'RTGS', 'IMPS', 'UPI'],
      default: null,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'POSTED', 'LOCKED'],
      default: 'DRAFT',
      index: true,
    },
    voucher_group_id: {
      type: String,
      default: null,
      index: true,
    },
    posted_date: {
      type: Date,
      default: null,
    },
    posted_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    
    created_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updated_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    // Bug #18: enables Mongoose's built-in version check (__v) on every
    // save() — a concurrent update to the same wage between another
    // request's findOne() and save() will throw VersionError instead of
    // silently overwriting the other write.
    optimisticConcurrency: true,
  }
);

// Compound indexes for performance
wageSchema.index({ firm_id: 1, salary_month: 1 });
wageSchema.index({ firm_id: 1, master_roll_id: 1, salary_month: 1 }, { unique: true });
wageSchema.index({ firm_id: 1, status: 1 });
wageSchema.index({ firm_id: 1, voucher_group_id: 1 });

const Wage = (mongoose.models.Wage || mongoose.model<IWage>('Wage', wageSchema)) as mongoose.Model<IWage>;

export default Wage;