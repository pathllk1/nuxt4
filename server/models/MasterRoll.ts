import mongoose, { Schema, Document } from 'mongoose';

export interface IMasterRoll extends Document {
  firm_id: mongoose.Types.ObjectId;
  employee_name: string;
  father_husband_name: string;
  date_of_birth: string;
  aadhar: string;
  pan?: string;
  phone_no: string;
  address: string;
  bank: string;
  account_no: string;
  ifsc: string;
  branch?: string;
  uan?: string;
  esic_no?: string;
  s_kalyan_no?: string;
  category: string;
  p_day_wage?: number;
  project?: string;
  site?: string;
  date_of_joining: string;
  date_of_exit?: string;
  doe_rem?: string;
  resignation_notice_period?: number;
  card_valid_until?: string;
  status: string;
  created_by: mongoose.Types.ObjectId | null;
  updated_by: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const masterRollSchema = new Schema<IMasterRoll>(
  {
    firm_id: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
    },
    employee_name:       { type: String, required: true },
    father_husband_name: { type: String, required: true },
    date_of_birth:       { type: String, required: true },
    aadhar:              { type: String, required: true },
    pan:                 { type: String },
    phone_no:            { type: String, required: true },
    address:             { type: String, required: true },
    bank:                { type: String, required: true },
    account_no:          { type: String, required: true },
    ifsc:                { type: String, required: true },
    branch:              { type: String },
    uan:                 { type: String },
    esic_no:             { type: String },
    s_kalyan_no:         { type: String },
    category:            { type: String, default: 'UNSKILLED' },
    p_day_wage:          { type: Number },
    project:             { type: String },
    site:                { type: String },
    date_of_joining:     { type: String, required: true },
    date_of_exit:        { type: String },
    doe_rem:             { type: String },
    resignation_notice_period: { type: Number },
    card_valid_until:    { type: String },
    status:              { type: String, default: 'Active' },
    created_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updated_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// Unique index for aadhar within a firm
masterRollSchema.index({ firm_id: 1, aadhar: 1 }, { unique: true });

const MasterRoll = mongoose.models.MasterRoll || mongoose.model<IMasterRoll>('MasterRoll', masterRollSchema);

export default MasterRoll;
