import mongoose, { Schema, Document } from 'mongoose';

export interface IBillItem {
  stockId?: mongoose.Types.ObjectId;
  item: string;
  hsn: string;
  qty: number;
  uom: string;
  rate: number;
  grate: number;
  disc?: number;
  total: number;
  cgst: number;
  sgst: number;
  igst: number;
  batch?: string;
  itemType?: 'GOODS' | 'SERVICE';
  narration?: string;
}

export interface IBillOtherCharge {
  name: string;
  amount: number;
  grate?: number;
  gst?: number;
  type?: string;
  hsnSac?: string;
  gstRate?: number;
}

export interface IBill extends Document {
  firmId: mongoose.Types.ObjectId;
  voucherId?: string;
  bno: string;
  bdate: string;
  
  // Party details (Bill-to)
  partyId: mongoose.Types.ObjectId;
  partyName: string;
  partyGstin?: string;
  partyAddress?: string;
  partyState?: string;
  partyStateCode?: string;
  partyPin?: string;

  // Firm registration details at time of billing
  firmGstin?: string;
  firmState?: string;
  firmStateCode?: string;

  // Totals
  grossTotal: number;
  netTotal: number;
  roundOff: number;
  cgst: number;
  sgst: number;
  igst: number;

  btype: 'SALES' | 'PURCHASE' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'PROFORMA' | 'DELIVERY_NOTE';
  billSubtype?: string;
  
  items: IBillItem[];
  otherCharges: IBillOtherCharge[];
  
  supplierBillNo?: string;
  orderNo?: string;
  vehicleNo?: string;
  dispatchThrough?: string;
  narration?: string;
  reverseCharge: boolean;
  
  refBillId?: mongoose.Types.ObjectId;
  
  status: 'ACTIVE' | 'CANCELLED' | 'CONVERTED';
  cancellationReason?: string;
  cancelledAt?: Date;
  cancelledBy?: mongoose.Types.ObjectId;

  // Consignee details
  consigneeName?: string;
  consigneeGstin?: string;
  consigneeAddress?: string;
  consigneeState?: string;
  consigneePin?: string;
  consigneeStateCode?: string;

  fileUrl?: string;
  filePath?: string;
  fileUploadedBy?: string;
  
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const BillItemSchema = new Schema({
  stockId: { type: Schema.Types.ObjectId, ref: 'Stock', required: false },
  item: { type: String, required: true },
  hsn: { type: String, required: true },
  qty: { type: Number, required: true },
  uom: { type: String, required: true },
  rate: { type: Number, required: true },
  grate: { type: Number, required: true },
  disc: { type: Number, default: 0 },
  total: { type: Number, required: true },
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
  batch: { type: String },
  itemType: { type: String, enum: ['GOODS', 'SERVICE'], default: 'GOODS' },
  narration: { type: String }
});

const BillSchema: Schema = new Schema(
  {
    firmId: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    voucherId: { type: String },
    bno: { type: String, required: true },
    bdate: { type: String, required: true },
    
    partyId: { type: Schema.Types.ObjectId, ref: 'Party', required: true, index: true },
    partyName: { type: String, required: true },
    partyGstin: { type: String },
    partyAddress: { type: String },
    partyState: { type: String },
    partyStateCode: { type: String },
    partyPin: { type: String },

    firmGstin: { type: String },
    firmState: { type: String },
    firmStateCode: { type: String },

    grossTotal: { type: Number, required: true, default: 0 },
    netTotal: { type: Number, required: true, default: 0 },
    roundOff: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },

    btype: { type: String, enum: ['SALES', 'PURCHASE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'PROFORMA', 'DELIVERY_NOTE'], required: true },
    billSubtype: { type: String },
    
    items: [BillItemSchema],
    otherCharges: [{ type: Schema.Types.Mixed }],
    
    supplierBillNo: { type: String },
    orderNo: { type: String },
    vehicleNo: { type: String },
    dispatchThrough: { type: String },
    narration: { type: String },
    reverseCharge: { type: Boolean, default: false },
    
    refBillId: { type: Schema.Types.ObjectId, ref: 'Bill', default: null },
    
    status: { type: String, enum: ['ACTIVE', 'CANCELLED', 'CONVERTED'], default: 'ACTIVE' },
    cancellationReason: { type: String },
    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },

    consigneeName: { type: String },
    consigneeGstin: { type: String },
    consigneeAddress: { type: String },
    consigneeState: { type: String },
    consigneePin: { type: String },
    consigneeStateCode: { type: String },

    fileUrl: { type: String },
    filePath: { type: String },
    fileUploadedBy: { type: String },
    
    createdBy: { type: String },
  },
  { timestamps: true }
);

BillSchema.index({ firmId: 1, bno: 1 }, { unique: true });
BillSchema.index({ firmId: 1, btype: 1, createdAt: -1 });
BillSchema.index({ firmId: 1, status: 1 });
BillSchema.index({ refBillId: 1 });

export default (mongoose.models.Bill as mongoose.Model<IBill>) || mongoose.model<IBill>('Bill', BillSchema);
