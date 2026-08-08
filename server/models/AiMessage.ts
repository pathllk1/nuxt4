import mongoose, { Schema, Document } from 'mongoose';

export interface IAiMessage extends Omit<Document, 'model'> {
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  provider?: string;
  model?: string;
  tokens_used?: number;
  created_at: Date;
  updated_at: Date;
}

const AiMessageSchema: Schema = new Schema({
  conversation_id: { type: String, required: true, index: true },
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  provider: { type: String },
  model: { type: String },
  tokens_used: { type: Number }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export default (mongoose.models.AiMessage || mongoose.model<IAiMessage>('AiMessage', AiMessageSchema)) as mongoose.Model<IAiMessage>;
