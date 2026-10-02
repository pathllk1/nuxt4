import mongoose, { Schema, Document } from 'mongoose';

export interface IVoucherSequence extends Document {
  firmId: mongoose.Types.ObjectId;
  vtype: 'PAYMENT' | 'RECEIPT' | 'JOURNAL' | 'CONTRA' | 'SALES' | 'PURCHASE' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'STOCK_ADJUSTMENT' | 'OPENING_BALANCE' | 'CLOSING_ENTRY';
  financialYear: string;
  prefix?: string;
  lastNo: number;
}

const VOUCHER_TYPE_ENUM = [
  'PAYMENT', 'RECEIPT', 'JOURNAL', 'CONTRA',
  'SALES', 'PURCHASE', 'CREDIT_NOTE', 'DEBIT_NOTE',
  'STOCK_ADJUSTMENT', 'OPENING_BALANCE', 'CLOSING_ENTRY',
];

const VoucherSequenceSchema: Schema = new Schema({
  firmId: { type: Schema.Types.ObjectId, ref: 'Firm', required: true },
  vtype: { type: String, enum: VOUCHER_TYPE_ENUM, required: true },
  financialYear: { type: String, default: 'LEGACY' },
  prefix: { type: String },
  lastNo: { type: Number, default: 0 },
});

// Gapless sequence: one counter per firm + voucher type + financial year.
// Old records with financialYear='LEGACY' remain valid (backward compat).
VoucherSequenceSchema.index({ firmId: 1, vtype: 1, financialYear: 1 }, { unique: true });

export default (mongoose.models.VoucherSequence || mongoose.model<IVoucherSequence>('VoucherSequence', VoucherSequenceSchema)) as mongoose.Model<IVoucherSequence>;
