import mongoose, { Schema, Document } from 'mongoose';

export interface IFirmSettings extends Document {
  firmId: mongoose.Types.ObjectId;
  settingKey: string;
  settingValue: string;
}

const FirmSettingsSchema: Schema = new Schema({
  firmId: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
  settingKey: { type: String, required: true },
  settingValue: { type: String, required: true },
});

FirmSettingsSchema.index({ firmId: 1, settingKey: 1 }, { unique: true });

export default (mongoose.models.FirmSettings || mongoose.model<IFirmSettings>('FirmSettings', FirmSettingsSchema)) as mongoose.Model<IFirmSettings>;
