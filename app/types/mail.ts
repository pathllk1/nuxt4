export interface MailAccount {
  id: string;
  firmId: string;
  userId: string;
  emailAddress: string;
  displayName: string;
  provider: 'CUSTOM_IMAP' | 'OFFICE_365' | 'GMAIL' | 'ZOHO';
  imapConfig: {
    host: string;
    port: number;
    secure: boolean;
  };
  smtpConfig: {
    host: string;
    port: number;
    secure: boolean;
  };
  syncSettings?: {
    syncIntervalMinutes: number;
    daysOfMailToKeep: number;
    syncFolders: string[];
  };
  encryptedVaultBlob?: string; // Opaque client-encrypted payload
  lastSyncAt?: string | null;
  lastSyncStatus?: 'SUCCESS' | 'ERROR' | 'SYNCING';
  lastSyncError?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MailFolder {
  id: string;
  accountId: string;
  firmId: string;
  name: string;
  path: string;
  delimiter: string;
  specialUse: 'INBOX' | 'SENT' | 'DRAFTS' | 'TRASH' | 'JUNK' | 'ARCHIVE' | 'USER';
  unreadCount: number;
  totalCount: number;
  uidValidity?: number;
  highestModSeq?: string;
  color?: string;
  orderIndex?: number;
  updatedAt?: string;
}

export interface MailAddress {
  name: string;
  address: string;
}

export interface MailAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  contentId?: string; // Inline image CID
  storageUrl?: string; // Pre-signed or data URL
  b2Key?: string; // Backblaze B2 object key/targetPath
  downloadUrl?: string; // Authenticated download endpoint URL
}

export interface MailSecurityStatus {
  spf: 'pass' | 'fail' | 'neutral' | 'unknown';
  dkim: 'pass' | 'fail' | 'unknown';
  dmarc: 'pass' | 'fail' | 'unknown';
  isExternal: boolean;
}

export interface MailMessage {
  id: string; // e.g., "msg::<accountId>::<uid>"
  type: 'message';
  accountId: string;
  folderId: string;
  firmId: string;
  userId: string;
  uid: number;
  messageId: string;
  threadId: string;
  subject: string;
  from: MailAddress;
  to: MailAddress[];
  cc: MailAddress[];
  bcc?: MailAddress[];
  replyTo?: MailAddress[];
  date: string;
  timestamp: number;
  snippet: string;
  bodyHtml?: string;
  bodyText?: string;
  hasAttachments: boolean;
  attachments?: MailAttachment[];
  isHydrated?: boolean; // True if body & attachments have been fully fetched
  flags: string[]; // ["\\Seen", "\\Flagged", "\\Answered"]
  isRead: boolean;
  isFlagged: boolean;
  isAnswered: boolean;
  importance: 'high' | 'normal' | 'low';
  tab: 'focused' | 'other';
  categories: string[];
  erpLinks?: {
    masterRollWorkerId?: string;
    partyId?: string;
    voucherGroupId?: string;
    siteExpenseId?: string;
  };
  security?: MailSecurityStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface MailThread {
  id: string;
  type: 'thread';
  accountId: string;
  firmId: string;
  subject: string;
  participantCount: number;
  participants: MailAddress[];
  messageCount: number;
  unreadCount: number;
  lastMessageTimestamp: number;
  snippet: string;
  hasAttachments: boolean;
  categories: string[];
  tab: 'focused' | 'other';
}

export interface MailContact {
  id: string;
  type: 'contact';
  firmId: string;
  userId: string;
  name: string;
  email: string;
  alternateEmails?: string[];
  phone?: string;
  mobile?: string;
  company?: string;
  jobTitle?: string;
  department?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  notes?: string;
  avatarUrl?: string;
  categories: string[];
  source: 'PERSONAL' | 'GAL_SYNC' | 'AUTO_COLLECTED';
  isFavorite: boolean;
  interactionStats: {
    lastEmailedAt?: number;
    sentCount: number;
    receivedCount: number;
    frequencyScore: number;
  };
  erpLinks?: {
    userId?: string;
    partyId?: string;
    masterRollId?: string;
    laborLeaderId?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface MailContactGroup {
  id: string;
  type: 'contact_group';
  firmId: string;
  userId: string;
  name: string;
  description?: string;
  color?: string;
  members: Array<{
    name: string;
    email: string;
    contactId?: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface EphemeralMailCredentials {
  accountId: string;
  emailAddress: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  username: string;
  password: string; // Plaintext ephemeral in memory only
  timestamp: number;
}

