import mongoose, { Schema, Document } from 'mongoose';

export interface IEmploymentTenure {
  _id?: mongoose.Types.ObjectId;
  tenure_no: number;
  project: string;
  site: string;
  category: string;
  p_day_wage: number;
  date_of_joining: string;
  date_of_exit?: string;
  exit_reason?: string;
  appointment_ref_no?: string;
  appointment_date?: string;
  status: string;
  bank?: string;
  account_no?: string;
  ifsc?: string;
  branch?: string;
  phone_no?: string;
  remarks?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

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
  tenures?: IEmploymentTenure[];
  created_by: mongoose.Types.ObjectId | null;
  updated_by: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const employmentTenureSchema = new Schema<IEmploymentTenure>(
  {
    tenure_no:          { type: Number, required: true },
    project:            { type: String, default: '' },
    site:               { type: String, default: '' },
    category:           { type: String, default: 'UNSKILLED' },
    p_day_wage:         { type: Number, default: 0 },
    date_of_joining:    { type: String, required: true },
    date_of_exit:       { type: String },
    exit_reason:        { type: String },
    appointment_ref_no: { type: String },
    appointment_date:   { type: String },
    status:             { type: String, default: 'Active' },
    bank:               { type: String },
    account_no:         { type: String },
    ifsc:               { type: String },
    branch:             { type: String },
    phone_no:           { type: String },
    remarks:            { type: String },
  },
  { timestamps: true }
);

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
    tenures:             { type: [employmentTenureSchema], default: [] },
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

const MasterRoll = (mongoose.models.MasterRoll || mongoose.model<IMasterRoll>('MasterRoll', masterRollSchema)) as mongoose.Model<IMasterRoll>;

export function getEmployeeTenures(employee: any): IEmploymentTenure[] {
  if (employee?.tenures && Array.isArray(employee.tenures) && employee.tenures.length > 0) {
    return employee.tenures;
  }
  const doj = employee?.date_of_joining || '';
  const yearStr = doj ? doj.slice(0, 4) : '2026';
  const idStr = employee?._id ? String(employee._id).slice(-6).toUpperCase() : '000000';
  return [
    {
      tenure_no: 1,
      project: employee?.project || '',
      site: employee?.site || '',
      category: employee?.category || 'UNSKILLED',
      p_day_wage: typeof employee?.p_day_wage === 'number' ? employee.p_day_wage : 0,
      date_of_joining: doj,
      date_of_exit: employee?.date_of_exit || undefined,
      exit_reason: employee?.doe_rem || undefined,
      appointment_ref_no: `APPT/${yearStr}/${idStr}-T1`,
      appointment_date: doj,
      status: employee?.status || (employee?.date_of_exit ? 'Left' : 'Active'),
      bank: employee?.bank || undefined,
      account_no: employee?.account_no || undefined,
      ifsc: employee?.ifsc || undefined,
      branch: employee?.branch || undefined,
      phone_no: employee?.phone_no || undefined,
      remarks: 'Initial Engagement'
    }
  ];
}

export default MasterRoll;
