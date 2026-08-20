import mongoose, { Schema, Document } from 'mongoose';

export interface IBatch {
  _id?: mongoose.Types.ObjectId;
  batch?: string;
  qty: number;
  uom: string;
  rate: number;
  grate: number;
  expiry?: Date;
  mrp?: number;
}

export interface IStock extends Document {
  firm_id: mongoose.Types.ObjectId;
  firmId?: mongoose.Types.ObjectId;
  item: string;
  pno?: string;
  oem?: string;
  hsn: string;
  qty: number;
  uom: string;
  rate: number;
  grate: number;
  total: number;
  mrp?: number;
  batches: IBatch[];
  user?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const batchSchema = new Schema({
  batch: { type: String },
  qty: { type: Number, required: true },
  uom: { type: String, required: true, default: 'PCS' },
  rate: { type: Number, required: true },
  grate: { type: Number, required: true, default: 18 },
  expiry: { type: Date },
  mrp: { type: Number },
}, { _id: true });

const stockSchema = new Schema(
  {
    firm_id: { type: Schema.Types.ObjectId, ref: 'Firm', required: true },
    firmId: { type: Schema.Types.ObjectId, ref: 'Firm' },
    item: { type: String, required: true },
    pno: { type: String },
    oem: { type: String },
    hsn: { type: String, required: true },
    qty: { type: Number, required: true, default: 0 },
    uom: { type: String, required: true, default: 'PCS' },
    rate: { type: Number, required: true, default: 0 },
    grate: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true, default: 0 },
    mrp: { type: Number },
    batches: [batchSchema],
    user: { type: String },
  },
  { timestamps: true }
);

stockSchema.pre('save', function (this: any) {
  if (this.firm_id && !this.firmId) {
    this.firmId = this.firm_id;
  } else if (this.firmId && !this.firm_id) {
    this.firm_id = this.firmId;
  }
});

stockSchema.index({ firm_id: 1, item: 1 }, { unique: true });

export default (mongoose.models.Stock || mongoose.model<IStock>('Stock', stockSchema)) as mongoose.Model<IStock>;
