import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISystemConfig extends Document {
  key: string;
  value: any;
  description?: string;
  category?: string;
  updatedAt: Date;
}

const SystemConfigSchema: Schema = new Schema({
  key: { type: String, required: true, unique: true, index: true },
  value: { type: Schema.Types.Mixed, required: true },
  description: { type: String },
  category: { type: String, default: 'general' }
}, {
  timestamps: true
});

const SystemConfigModel: Model<ISystemConfig> = (mongoose.models.SystemConfig as Model<ISystemConfig>) || mongoose.model<ISystemConfig>('SystemConfig', SystemConfigSchema);

export default SystemConfigModel;
