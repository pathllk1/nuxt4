import mongoose, { Schema, Document } from 'mongoose';

export interface ILedger extends Document {
  firmId: mongoose.Types.ObjectId;
  transactionDate: string;
  accountHead: string;
  accountType: string;
  debitAmount: number;
  creditAmount: number;
  narration?: string;
  refType?: string;
  refId?: mongoose.Types.ObjectId;
  voucherGroupId?: string;
  bankAccountId?: mongoose.Types.ObjectId;
  paymentMode?: string;
  isWageEntry?: boolean;
  masterRollId?: mongoose.Types.ObjectId;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LedgerSchema = new Schema<ILedger>(
  {
    firmId: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
      index: true,
    },
    transactionDate: {
      type: String,
      required: true,
    },
    accountHead: {
      type: String,
      required: true,
      index: true,
    },
    accountType: {
      type: String,
      required: true,
    },
    debitAmount: {
      type: Number,
      default: 0,
    },
    creditAmount: {
      type: Number,
      default: 0,
    },
    narration: {
      type: String,
    },
    refType: {
      type: String,
      index: true,
    },
    refId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    voucherGroupId: {
      type: String,
      default: null,
      index: true,
    },
    bankAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'BankAccount',
      default: null,
    },
    paymentMode: {
      type: String,
      default: null,
    },
    isWageEntry: {
      type: Boolean,
      default: false,
    },
    masterRollId: {
      type: Schema.Types.ObjectId,
      ref: 'MasterRoll',
      default: null,
    },
    createdBy: {
      type: String,
    },
  },
  { timestamps: true }
);

LedgerSchema.index({ firmId: 1, transactionDate: 1 });
LedgerSchema.index({ firmId: 1, accountHead: 1, transactionDate: 1 });

export default (mongoose.models.Ledger as mongoose.Model<ILedger>) || mongoose.model<ILedger>('Ledger', LedgerSchema);
