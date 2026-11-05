import mongoose, { Schema, Document } from 'mongoose';

export interface IEmployeeSiteTransfer extends Document {
  firm_id: mongoose.Types.ObjectId;
  master_roll_id: mongoose.Types.ObjectId;
  from_project?: string | null;
  from_site?: string | null;
  to_project: string;
  to_site: string;
  effective_date: string; // YYYY-MM-DD
  transfer_type: 'PERMANENT' | 'TEMPORARY' | 'ROTATION';
  return_expected_date?: string | null;
  transfer_order_no?: string | null;
  advance_balance_at_transfer: number;
  remarks?: string | null;
  status: 'COMPLETED' | 'CANCELLED';
  created_by: mongoose.Types.ObjectId;
  updated_by?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const employeeSiteTransferSchema = new Schema<IEmployeeSiteTransfer>(
  {
    firm_id: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
      index: true,
    },
    master_roll_id: {
      type: Schema.Types.ObjectId,
      ref: 'MasterRoll',
      required: true,
      index: true,
    },
    from_project: {
      type: String,
      default: null,
    },
    from_site: {
      type: String,
      default: null,
    },
    to_project: {
      type: String,
      required: true,
    },
    to_site: {
      type: String,
      required: true,
    },
    effective_date: {
      type: String,
      required: true,
      index: true,
    },
    transfer_type: {
      type: String,
      enum: ['PERMANENT', 'TEMPORARY', 'ROTATION'],
      default: 'PERMANENT',
    },
    return_expected_date: {
      type: String,
      default: null,
    },
    transfer_order_no: {
      type: String,
      default: null,
      trim: true,
    },
    advance_balance_at_transfer: {
      type: Number,
      default: 0,
    },
    remarks: {
      type: String,
      default: null,
      trim: true,
    },
    status: {
      type: String,
      enum: ['COMPLETED', 'CANCELLED'],
      default: 'COMPLETED',
      index: true,
    },
    created_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updated_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

employeeSiteTransferSchema.index({ firm_id: 1, master_roll_id: 1, effective_date: -1 });
employeeSiteTransferSchema.index({ firm_id: 1, to_site: 1, effective_date: -1 });

const EmployeeSiteTransfer = (mongoose.models.EmployeeSiteTransfer as mongoose.Model<IEmployeeSiteTransfer>) ||
  mongoose.model<IEmployeeSiteTransfer>('EmployeeSiteTransfer', employeeSiteTransferSchema);

export default EmployeeSiteTransfer;

