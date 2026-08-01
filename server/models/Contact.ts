import mongoose, { Schema, Document } from 'mongoose';

export interface IContact extends Document {
  firmId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  contactType: 'customer' | 'vendor' | 'employee' | 'other';
  status: 'active' | 'inactive' | 'archived';
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ContactSchema: Schema = new Schema({
  firmId: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String },
  company: { type: String },
  address: { type: String },
  city: { type: String },
  state: { type: String },
  country: { type: String },
  pincode: { type: String },
  contactType: {
    type: String,
    enum: ['customer', 'vendor', 'employee', 'other'],
    default: 'customer'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'archived'],
    default: 'active'
  },
  notes: { type: String },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

ContactSchema.index({ firmId: 1, email: 1 }, { unique: true });
ContactSchema.index({ firmId: 1, status: 1 });
ContactSchema.index({ firmId: 1, contactType: 1 });
ContactSchema.index({ firmId: 1, createdAt: -1 });

export default mongoose.models.Contact || mongoose.model<IContact>('Contact', ContactSchema);
