import mongoose, { Schema, Document } from 'mongoose';

export interface IFirmLocation {
  gst_number?: string;
  state_code?: string;
  state?: string;
  registration_type: 'PPOB' | 'APOB';
  address?: string;
  city?: string;
  pincode?: string;
  is_default: boolean;
}

export interface IFirm extends Document {
  name: string;
  code?: string;
  description?: string;
  legal_name?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  gst_number?: string;
  locations: IFirmLocation[];
  phone_number?: string;
  secondary_phone?: string;
  email?: string;
  website?: string;
  business_type?: string;
  industry_type?: string;
  establishment_year?: number;
  employee_count?: number;
  registration_number?: string;
  registration_date?: string;
  cin_number?: string;
  pan_number?: string;
  tax_id?: string;
  vat_number?: string;
  bank_account_number?: string;
  bank_name?: string;
  bank_branch?: string;
  ifsc_code?: string;
  payment_terms?: string;
  status: 'pending' | 'approved' | 'rejected';
  license_numbers?: string;
  insurance_details?: string;
  currency: string;
  timezone: string;
  fiscal_year_start?: string;
  invoice_prefix?: string;
  quote_prefix?: string;
  po_prefix?: string;
  logo_url?: string;
  invoice_template?: string;
  enable_e_invoice: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const firmSchema = new Schema(
  {
    name:                { type: String, required: true, unique: true },
    code:                { type: String },
    description:         { type: String },
    legal_name:          { type: String },
    address:             { type: String },
    city:                { type: String },
    state:               { type: String },
    country:             { type: String },
    pincode:             { type: String },
    gst_number:          { type: String },
    locations: [
      {
        gst_number:        { type: String },
        state_code:        { type: String },
        state:             { type: String },
        registration_type: {
          type:    String,
          enum:    ['PPOB', 'APOB'],
          default: 'PPOB',
        },
        address:           { type: String },
        city:              { type: String },
        pincode:           { type: String },
        is_default:        { type: Boolean, default: false },
      },
    ],
    phone_number:        { type: String },
    secondary_phone:     { type: String },
    email:               { type: String },
    website:             { type: String },
    business_type:       { type: String },
    industry_type:       { type: String },
    establishment_year:  { type: Number },
    employee_count:      { type: Number },
    registration_number: { type: String },
    registration_date:   { type: String },
    cin_number:          { type: String },
    pan_number:          { type: String },
    tax_id:              { type: String },
    vat_number:          { type: String },
    bank_account_number: { type: String },
    bank_name:           { type: String },
    bank_branch:         { type: String },
    ifsc_code:           { type: String },
    payment_terms:       { type: String },
    status:              {
      type:    String,
      enum:    ['pending', 'approved', 'rejected'],
      default: 'approved',
    },
    license_numbers:     { type: String },
    insurance_details:   { type: String },
    currency:            { type: String, default: 'INR' },
    timezone:            { type: String, default: 'Asia/Kolkata' },
    fiscal_year_start:   { type: String },
    invoice_prefix:      { type: String },
    quote_prefix:        { type: String },
    po_prefix:           { type: String },
    logo_url:            { type: String },
    invoice_template:    { type: String },
    enable_e_invoice:    { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default (mongoose.models.Firm || mongoose.model<IFirm>('Firm', firmSchema)) as mongoose.Model<IFirm>;
