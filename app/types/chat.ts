export interface ChatReplyContext {
  messageId: string;
  senderId: string;
  senderName?: string;
  content: string;
}

export interface ChatForwardContext {
  originalMessageId: string;
  originalSenderId: string;
  originalSenderName?: string;
  originalTimestamp: number;
}

export interface ChatAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  width?: number;
  height?: number;
}

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

export interface ChatMessage {
  type: 'message';
  chatId: string;
  messageId: string;
  senderId: string;
  recipientId: string;
  senderName?: string;
  content: string;
  timestamp: number;
  replyTo?: ChatReplyContext | null;
  forwardedFrom?: ChatForwardContext | null;
  reactions?: Record<string, string[]>;
  status?: MessageStatus;
  deliveredAt?: number | null;
  readAt?: number | null;
  isDeleted?: boolean;
  deletedAt?: number | null;
  attachments?: ChatAttachment[];
}

export interface ContactFirmInfo {
  firmId: string;
  firmName: string;
  grade: string;
}

export interface ChatContact {
  id: string;
  _id: string;
  name: string;
  email: string;
  role?: string;
  status?: string;
  firms?: ContactFirmInfo[];
  isOwnFirm?: boolean;
  primaryFirmName?: string;
  lastMessage?: string;
  lastMessageTimestamp?: number;
  unreadCount?: number;
  isOnline?: boolean;
  lastSeenAt?: number;
}
