import mongoose, { Schema, Document } from 'mongoose';

export interface IGstLocation {
  gstin: string;
  stateCode: string;
  state: string;
  address: string;
  city?: string;
  pincode?: string;
  contact?: string;
  isPrimary: boolean;
}

export interface IParty extends Document {
  firmId: mongoose.Types.ObjectId;
  name: string;
  gstin: string;
  contact?: string;
  state?: string;
  stateCode?: string;
  address?: string;
  pin?: string;
  pan?: string;
  gstLocations: IGstLocation[];
  primaryGstinIndex: number;
  partyType: 'CUSTOMER' | 'SUPPLIER' | 'BOTH';
  openingBalance: number;
  balanceType: 'DR' | 'CR';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const PartySchema: Schema = new Schema(
  {
    firmId: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    gstin: { type: String, default: 'UNREGISTERED' },
    contact: { type: String },
    state: { type: String },
    stateCode: { type: String },
    address: { type: String },
    pin: { type: String },
    pan: { type: String },
    gstLocations: [
      {
        gstin: { type: String },
        stateCode: { type: String },
        state: { type: String },
        address: { type: String },
        city: { type: String },
        pincode: { type: String },
        contact: { type: String },
        isPrimary: { type: Boolean, default: false },
      },
    ],
    primaryGstinIndex: { type: Number, default: 0 },
    partyType: { type: String, enum: ['CUSTOMER', 'SUPPLIER', 'BOTH'], default: 'CUSTOMER' },
    openingBalance: { type: Number, default: 0 },
    balanceType: { type: String, enum: ['DR', 'CR'], default: 'DR' },
    createdBy: { type: String },
  },
  { timestamps: true }
);

PartySchema.index({ firmId: 1, name: 1 }, { unique: true });

export default (mongoose.models.Party as mongoose.Model<IParty>) || mongoose.model<IParty>('Party', PartySchema);
