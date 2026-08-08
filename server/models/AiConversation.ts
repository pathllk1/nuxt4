import mongoose, { Schema, Document } from 'mongoose';

export interface IAiConversation extends Omit<Document, 'model'> {
  user_id: string;
  title: string;
  provider: string;
  model: string;
  is_pinned: boolean;
  message_count: number;
  created_at: Date;
  updated_at: Date;
}

const AiConversationSchema: Schema = new Schema({
  user_id: { type: String, required: true, index: true },
  title: { type: String, required: true, default: 'New Chat' },
  provider: { type: String, required: true },
  model: { type: String, required: true },
  is_pinned: { type: Boolean, default: false, index: true },
  message_count: { type: Number, default: 0 }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export default (mongoose.models.AiConversation || mongoose.model<IAiConversation>('AiConversation', AiConversationSchema)) as mongoose.Model<IAiConversation>;
