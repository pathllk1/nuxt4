import mongoose, { Schema, Document } from 'mongoose';

export interface ILedger extends Document {
  firmId: mongoose.Types.ObjectId;
  firm_id?: mongoose.Types.ObjectId;
  transactionDate: string;
  accountHead: string;
  accountType: string;
  accountCode?: string | null;
  debitAmount: number;
  creditAmount: number;
  narration?: string;
  refType?: string;
  refId?: mongoose.Types.ObjectId;
  voucherGroupId?: string;
  voucherNo?: string;
  voucherType?: string;
  partyId?: mongoose.Types.ObjectId;
  stockId?: mongoose.Types.ObjectId;
  stockRegId?: mongoose.Types.ObjectId;
  bankAccountId?: mongoose.Types.ObjectId;
  paymentMode?: string;
  isWageEntry?: boolean;
  masterRollId?: mongoose.Types.ObjectId;
  legIndex?: number;
  isReversed?: boolean;
  reversalVoucherGroupId?: string | null;
  reversedAt?: Date | null;
  reversedBy?: string | null;
  replacesVoucherGroupId?: string | null;
  statutory?: Record<string, any> | null;
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
    firm_id: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
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
    accountCode: {
      type: String,
      trim: true,
      default: null,
      index: true,
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
    voucherNo: {
      type: String,
      default: null,
      index: true,
    },
    voucherType: {
      type: String,
      default: null,
      index: true,
    },
    partyId: {
      type: Schema.Types.ObjectId,
      ref: 'Party',
      default: null,
      index: true,
    },
    stockId: {
      type: Schema.Types.ObjectId,
      ref: 'Stock',
      default: null,
      index: true,
    },
    stockRegId: {
      type: Schema.Types.ObjectId,
      ref: 'StockReg',
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
    legIndex: {
      type: Number,
      default: 0,
      index: true,
    },
    isReversed: {
      type: Boolean,
      default: false,
      index: true,
    },
    reversalVoucherGroupId: {
      type: String,
      default: null,
      index: true,
    },
    reversedAt: {
      type: Date,
      default: null,
    },
    reversedBy: {
      type: String,
      default: null,
    },
    replacesVoucherGroupId: {
      type: String,
      default: null,
      index: true,
    },
    statutory: {
      type: Schema.Types.Mixed,
      default: null,
    },
    createdBy: {
      type: String,
    },
  },
  { timestamps: true }
);

LedgerSchema.pre('save', function () {
  if (this.firmId && !(this as any).firm_id) (this as any).firm_id = this.firmId;
  if ((this as any).firm_id && !this.firmId) this.firmId = (this as any).firm_id;
});

LedgerSchema.index({ firmId: 1, transactionDate: 1 });
LedgerSchema.index({ firmId: 1, accountHead: 1, transactionDate: 1 });
LedgerSchema.index(
  { firmId: 1, voucherGroupId: 1, legIndex: 1 },
  { unique: true, partialFilterExpression: { isReversed: false, voucherGroupId: { $type: 'string' } } }
);
LedgerSchema.index({ firmId: 1, voucherType: 1, voucherGroupId: 1 });
LedgerSchema.index({ firmId: 1, partyId: 1, transactionDate: 1 });
LedgerSchema.index({ firmId: 1, masterRollId: 1, transactionDate: 1 });
LedgerSchema.index({ firmId: 1, bankAccountId: 1, transactionDate: 1 });
LedgerSchema.index({ firmId: 1, accountCode: 1, transactionDate: 1 });

export default (mongoose.models.Ledger as mongoose.Model<ILedger>) || mongoose.model<ILedger>('Ledger', LedgerSchema);
