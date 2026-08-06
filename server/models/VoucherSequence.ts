import mongoose, { Schema, Document } from 'mongoose';

export interface IVoucherSequence extends Document {
  firmId: mongoose.Types.ObjectId;
  vtype: 'PAYMENT' | 'RECEIPT' | 'JOURNAL' | 'CONTRA';
  prefix?: string;
  lastNo: number;
}

const VoucherSequenceSchema: Schema = new Schema({
  firmId: { type: Schema.Types.ObjectId, ref: 'Firm', required: true },
  vtype: { type: String, enum: ['PAYMENT', 'RECEIPT', 'JOURNAL', 'CONTRA'], required: true },
  prefix: { type: String },
  lastNo: { type: Number, default: 0 },
});

VoucherSequenceSchema.index({ firmId: 1, vtype: 1 }, { unique: true });

export default (mongoose.models.VoucherSequence || mongoose.model<IVoucherSequence>('VoucherSequence', VoucherSequenceSchema)) as mongoose.Model<IVoucherSequence>;
