import mongoose, { Schema, Document } from 'mongoose';
import Firm from './Firm';
import User from './User';

export type SubcontractorExpenseCategory = 
  | 'LABOR' 
  | 'MATERIAL' 
  | 'FUEL_DIESEL' 
  | 'MACHINERY_RENTAL' 
  | 'TRANSPORT' 
  | 'FOOD_WELFARE' 
  | 'REPAIRS' 
  | 'OTHER';

export interface ISubcontractorExpense extends Document {
  firmId: mongoose.Types.ObjectId;
  subcontractorUserId: mongoose.Types.ObjectId;
  subcontractorName: string;
  projectId?: string;
  
  expenseDate: string; // YYYY-MM-DD
  category: SubcontractorExpenseCategory;
  amount: number;
  paymentMode: 'CASH' | 'UPI' | 'BANK';
  vendorOrPayee?: string;
  notes?: string;
  billOrSlipRef?: string;

  createdAt: Date;
  updatedAt: Date;
}

const SubcontractorExpenseSchema = new Schema<ISubcontractorExpense>(
  {
    firmId: { 
      type: Schema.Types.ObjectId, 
      ref: Firm, 
      required: true, 
      index: true 
    },
    subcontractorUserId: { 
      type: Schema.Types.ObjectId, 
      ref: User, 
      required: true, 
      index: true 
    },
    subcontractorName: { 
      type: String, 
      required: true, 
      trim: true 
    },
    projectId: { 
      type: String, 
      default: null, 
      trim: true 
    },
    expenseDate: { 
      type: String, 
      required: true, 
      index: true 
    },
    category: {
      type: String,
      enum: [
        'LABOR', 
        'MATERIAL', 
        'FUEL_DIESEL', 
        'MACHINERY_RENTAL', 
        'TRANSPORT', 
        'FOOD_WELFARE', 
        'REPAIRS', 
        'OTHER'
      ],
      default: 'OTHER',
      required: true,
      index: true
    },
    amount: { 
      type: Number, 
      required: true, 
      min: [0.01, 'Amount must be greater than zero'] 
    },
    paymentMode: {
      type: String,
      enum: ['CASH', 'UPI', 'BANK'],
      default: 'CASH'
    },
    vendorOrPayee: { 
      type: String, 
      default: '', 
      trim: true 
    },
    notes: { 
      type: String, 
      default: '', 
      trim: true 
    },
    billOrSlipRef: { 
      type: String, 
      default: '', 
      trim: true 
    }
  },
  { 
    timestamps: true 
  }
);

// Compound index for optimal querying by firm, contractor, and date
SubcontractorExpenseSchema.index({ firmId: 1, subcontractorUserId: 1, expenseDate: -1 });

export default (mongoose.models.SubcontractorExpense || 
  mongoose.model<ISubcontractorExpense>('SubcontractorExpense', SubcontractorExpenseSchema)) as mongoose.Model<ISubcontractorExpense>;
