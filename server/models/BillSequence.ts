import mongoose, { Schema, Document } from 'mongoose';

export interface IBillSequence extends Document {
  firmId: mongoose.Types.ObjectId;
  btype: 'SALES' | 'PURCHASE' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'PROFORMA' | 'DELIVERY_NOTE';
  prefix?: string;
  lastNo: number;
}

const BillSequenceSchema: Schema = new Schema({
  firmId: { type: Schema.Types.ObjectId, ref: 'Firm', required: true },
  btype: { type: String, enum: ['SALES', 'PURCHASE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'PROFORMA', 'DELIVERY_NOTE'], required: true },
  prefix: { type: String },
  lastNo: { type: Number, default: 0 },
});

BillSequenceSchema.index({ firmId: 1, btype: 1 }, { unique: true });

export default (mongoose.models.BillSequence || mongoose.model<IBillSequence>('BillSequence', BillSequenceSchema)) as mongoose.Model<IBillSequence>;
