import mongoose, { Schema, Document } from 'mongoose';

export interface IAdvance extends Document {
  firm_id: mongoose.Types.ObjectId;
  master_roll_id: mongoose.Types.ObjectId;
  type: 'ADVANCE' | 'REPAYMENT';
  amount: number;
  date: string;
  payment_mode: 'CASH' | 'BANK' | 'WAGE_DEDUCTION';
  bank_account_details?: string;
  bank_account_id: mongoose.Types.ObjectId | null;
  wage_id: mongoose.Types.ObjectId | null;
  remarks?: string;
  voucher_group_id?: string | null;
  created_by: mongoose.Types.ObjectId;
  updated_by: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const advanceSchema = new Schema<IAdvance>(
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
    type: {
      type: String,
      enum: ['ADVANCE', 'REPAYMENT'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    date: {
      type: String,
      required: true, // YYYY-MM-DD
    },
    payment_mode: {
      type: String,
      enum: ['CASH', 'BANK', 'WAGE_DEDUCTION'],
      default: 'CASH',
    },
    bank_account_details: {
      type: String,
    },
    bank_account_id: {
      type: Schema.Types.ObjectId,
      ref: 'BankAccount',
      index: true,
    },
    wage_id: {
      type: Schema.Types.ObjectId,
      ref: 'Wage',
      index: true,
    },
    remarks: {
      type: String,
    },
    voucher_group_id: {
      type: String,
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
  { timestamps: true }
);

const Advance = mongoose.model<IAdvance>('Advance', advanceSchema);

export default Advance;
