import mongoose, { Schema, Document } from 'mongoose';

export interface IStockReg extends Document {
  firm_id: mongoose.Types.ObjectId;
  type: string;
  bno?: string;
  bdate?: string;
  supply?: string;
  item_type?: string;
  show_qty?: boolean;
  item: string;
  item_narration?: string;
  batch?: string;
  hsn?: string;
  qty: number;
  uom?: string;
  rate?: number;
  grate?: number;
  disc?: number;
  total?: number;
  cost_rate?: number;
  stock_id?: mongoose.Types.ObjectId;
  bill_id?: mongoose.Types.ObjectId;
  user?: string;
  firm?: string;
  qtyh?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const stockRegSchema = new Schema(
  {
    firm_id: { type: Schema.Types.ObjectId, ref: 'Firm', required: true },
    type: { type: String, required: true },
    bno: { type: String },
    bdate: { type: String },
    supply: { type: String },
    item_type: { type: String, default: 'GOODS' },
    show_qty: { type: Boolean, default: true },
    item: { type: String, required: true },
    item_narration: { type: String },
    batch: { type: String },
    hsn: { type: String },
    qty: { type: Number, required: true },
    uom: { type: String },
    rate: { type: Number, default: 0 },
    grate: { type: Number, default: 0 },
    disc: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    cost_rate: { type: Number, default: null },
    stock_id: { type: Schema.Types.ObjectId, ref: 'Stock', default: null },
    bill_id: { type: Schema.Types.ObjectId, ref: 'Bill', default: null },
    user: { type: String },
    firm: { type: String },
    qtyh: { type: Number, default: 0 },
  },
  { timestamps: true }
);

stockRegSchema.index({ firm_id: 1, bill_id: 1 });
stockRegSchema.index({ firm_id: 1, stock_id: 1, type: 1 });
stockRegSchema.index({ firm_id: 1, type: 1 });

export default mongoose.models.StockReg || mongoose.model<IStockReg>('StockReg', stockRegSchema);
