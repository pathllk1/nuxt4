import mongoose, { Schema, Document } from 'mongoose';

export interface IBillSequence extends Document {
  firmId: mongoose.Types.ObjectId;
  btype: 'SALES' | 'PURCHASE' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'PROFORMA' | 'DELIVERY_NOTE' | string;
  financialYear: string;
  prefix?: string;
  lastNo: number;
}

const BillSequenceSchema: Schema = new Schema({
  firmId: { type: Schema.Types.ObjectId, ref: 'Firm', required: true },
  btype: { type: String, required: true },
  financialYear: { type: String, required: true },
  prefix: { type: String },
  lastNo: { type: Number, default: 0 },
});

BillSequenceSchema.index({ firmId: 1, btype: 1, financialYear: 1 }, { unique: true });

export default (mongoose.models.BillSequence || mongoose.model<IBillSequence>('BillSequence', BillSequenceSchema)) as mongoose.Model<IBillSequence>;
