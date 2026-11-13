import mongoose, { Schema, Document } from 'mongoose';

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
    },
    validTo: {
      type: String,
      required: true,
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

TdsExemptionCertificateSchema.index(
  { firmId: 1, pan: 1, section: 1, status: 1, validFrom: 1, validTo: 1 }
);

export default (mongoose.models.TdsExemptionCertificate as mongoose.Model<ITdsExemptionCertificate>) ||
  mongoose.model<ITdsExemptionCertificate>('TdsExemptionCertificate', TdsExemptionCertificateSchema);

