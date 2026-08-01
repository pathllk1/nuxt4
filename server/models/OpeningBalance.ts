import mongoose, { Schema, Document } from 'mongoose';

export interface IOpeningBalance extends Document {
  firmId: mongoose.Types.ObjectId;
  accountHead: string;
  accountType: string;
  debitAmount: number;
  creditAmount: number;
  financialYear: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const OpeningBalanceSchema: Schema = new Schema(
  {
    firmId: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    accountHead: { type: String, required: true, index: true },
    accountType: { type: String, required: true },
    debitAmount: { type: Number, default: 0 },
    creditAmount: { type: Number, default: 0 },
    financialYear: { type: String, required: true },
    createdBy: { type: String },
  },
  { timestamps: true }
);

OpeningBalanceSchema.index({ firmId: 1, accountHead: 1, financialYear: 1 }, { unique: true });

export default mongoose.models.OpeningBalance || mongoose.model<IOpeningBalance>('OpeningBalance', OpeningBalanceSchema);
