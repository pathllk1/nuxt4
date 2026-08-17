import mongoose, { Schema, Document } from 'mongoose';

export interface IBulkPaymentItem {
  accountHead: string;
  accountType?: string;
  partyId?: mongoose.Types.ObjectId | null;
  beneficiaryName: string;
  beneficiaryAccountNo: string;
  beneficiaryIfsc: string;
  beneficiaryBankName?: string;
  beneficiaryBranch?: string;
  beneficiaryAccountType?: string;
  paysysId: string;
  amount: number;
  narration?: string;
  voucherGroupId?: string;
  voucherNo?: string;
}

export interface IBulkPayment extends Document {
  firmId: mongoose.Types.ObjectId;
  batchNo: string;
  paymentDate: string;
  bankAccountId: mongoose.Types.ObjectId;
  bankAccountName: string;
  bankAccountNumber: string;
  chequeNo: string;
  defaultPaysys: string;
  totalAmount: number;
  totalCount: number;
  status: 'POSTED' | 'DRAFT' | 'CANCELLED';
  items: IBulkPaymentItem[];
  narration?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const BulkPaymentItemSchema = new Schema<IBulkPaymentItem>(
  {
    accountHead: { type: String, required: true, trim: true },
    accountType: { type: String, default: 'EXPENSE' },
    partyId: { type: Schema.Types.ObjectId, ref: 'Party', default: null },
    beneficiaryName: { type: String, required: true, trim: true },
    beneficiaryAccountNo: { type: String, required: true, trim: true },
    beneficiaryIfsc: { type: String, required: true, trim: true, uppercase: true },
    beneficiaryBankName: { type: String, default: '', trim: true },
    beneficiaryBranch: { type: String, default: '', trim: true },
    beneficiaryAccountType: { type: String, default: '10', trim: true },
    paysysId: { type: String, default: 'NEFT', enum: ['NEFT', 'RTGS'] },
    amount: { type: Number, required: true, min: 0 },
    narration: { type: String, default: '', trim: true },
    voucherGroupId: { type: String, default: null },
    voucherNo: { type: String, default: null },
  },
  { _id: true }
);

const BulkPaymentSchema = new Schema<IBulkPayment>(
  {
    firmId: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
      index: true,
    },
    batchNo: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    paymentDate: {
      type: String,
      required: true,
    },
    bankAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'BankAccount',
      required: true,
    },
    bankAccountName: {
      type: String,
      required: true,
      trim: true,
    },
    bankAccountNumber: {
      type: String,
      required: true,
      trim: true,
    },
    chequeNo: {
      type: String,
      default: '',
      trim: true,
    },
    defaultPaysys: {
      type: String,
      default: 'NEFT',
      enum: ['NEFT', 'RTGS'],
    },
    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    totalCount: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: ['POSTED', 'DRAFT', 'CANCELLED'],
      default: 'POSTED',
      index: true,
    },
    items: [BulkPaymentItemSchema],
    narration: {
      type: String,
      default: '',
      trim: true,
    },
    createdBy: {
      type: String,
      default: 'system',
    },
  },
  { timestamps: true }
);

BulkPaymentSchema.index({ firmId: 1, batchNo: 1 }, { unique: true });
BulkPaymentSchema.index({ firmId: 1, paymentDate: -1 });

export default (mongoose.models.BulkPayment as mongoose.Model<IBulkPayment>) ||
  mongoose.model<IBulkPayment>('BulkPayment', BulkPaymentSchema);
