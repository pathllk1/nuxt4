import mongoose, { Schema, Document } from 'mongoose';

export interface IWageJob extends Document {
  firm_id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  salary_month: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  total_wages: number;
  processed_wages: number;
  failed_wages: number;
  progress_percentage: number;
  wages_data: any[];
  results: any[];
  error_message: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  duration_ms: number;
  createdAt: Date;
  updatedAt: Date;
}

const wageJobSchema = new Schema<IWageJob>(
  {
    firm_id: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
      index: true,
    },
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    salary_month: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    total_wages: {
      type: Number,
      default: 0,
    },
    processed_wages: {
      type: Number,
      default: 0,
    },
    failed_wages: {
      type: Number,
      default: 0,
    },
    progress_percentage: {
      type: Number,
      default: 0,
    },
    wages_data: {
      type: [],
      default: [],
    },
    results: {
      type: [],
      default: [],
    },
    error_message: {
      type: String,
      default: null,
    },
    started_at: {
      type: Date,
      default: null,
    },
    completed_at: {
      type: Date,
      default: null,
    },
    duration_ms: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Index for finding jobs by firm and status
wageJobSchema.index({ firm_id: 1, status: 1 });
wageJobSchema.index({ firm_id: 1, createdAt: -1 });

const WageJob = mongoose.model<IWageJob>('WageJob', wageJobSchema);

export default WageJob;
