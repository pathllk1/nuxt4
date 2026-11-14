import mongoose, { Schema, Document } from 'mongoose';

const isIsoCalendarDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

// ─────────────────────────────────────────────────────────────────────────
// TdsExemptionCertificate Model (F-03)
//
// Stores statutory lower/nil deduction certificates (Section 197 / 194C(6)).
// Rate overrides in TDS calculation endpoints MUST match an active,
// firm-scoped certificate record covering the payment date and section.
// Free-text query parameters cannot authorize statutory rate overrides.
// ─────────────────────────────────────────────────────────────────────────

export interface ITdsExemptionCertificate extends Document {
  firmId: mongoose.Types.ObjectId;
  partyId?: mongoose.Types.ObjectId | null;
  pan: string;
  section: string; // e.g. '194C'
  certificateNumber: string;
  validFrom: string; // YYYY-MM-DD
  validTo: string;   // YYYY-MM-DD
  permittedRate: number; // Statutory approved rate (e.g. 0% or 0.5%)
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  issuingAuthority?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TdsExemptionCertificateSchema = new Schema<ITdsExemptionCertificate>(
  {
    firmId: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
      index: true,
    },
    partyId: {
      type: Schema.Types.ObjectId,
      ref: 'Party',
      default: null,
      index: true,
    },
    pan: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    section: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    certificateNumber: {
      type: String,
      required: true,
      trim: true,
    },
    validFrom: {
      type: String,
      required: true,
      validate: {
        validator: isIsoCalendarDate,
        message: 'validFrom must be a real calendar date in YYYY-MM-DD format'
      }
    },
    validTo: {
      type: String,
      required: true,
      validate: {
        validator: isIsoCalendarDate,
        message: 'validTo must be a real calendar date in YYYY-MM-DD format'
      }
    },
    permittedRate: {
      type: Number,
      required: true,
      min: 0,
      max: 20,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'EXPIRED', 'REVOKED'],
      default: 'ACTIVE',
    },
    issuingAuthority: {
      type: String,
      default: 'Income Tax Department',
    },
  },
  { timestamps: true }
);

TdsExemptionCertificateSchema.pre('validate', function () {
  if (
    isIsoCalendarDate(this.validFrom) &&
    isIsoCalendarDate(this.validTo) &&
    this.validFrom > this.validTo
  ) {
    this.invalidate('validTo', 'validTo must not be earlier than validFrom');
  }
});

TdsExemptionCertificateSchema.index(
  { firmId: 1, pan: 1, section: 1, status: 1, validFrom: 1, validTo: 1 }
);

export default (mongoose.models.TdsExemptionCertificate as mongoose.Model<ITdsExemptionCertificate>) ||
  mongoose.model<ITdsExemptionCertificate>('TdsExemptionCertificate', TdsExemptionCertificateSchema);

