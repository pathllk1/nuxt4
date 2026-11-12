# Enterprise Outlook Email Client: Architecture & Technical Specification

> **Document Version:** 1.1.0  
> **Status:** Architecture Approved & Production Roadmap  
> **Target Framework:** Nuxt 4 (Vue 3.5, Nuxt UI v4, Tailwind CSS v4)  
> **Primary Storage:** Couchbase Capella (Pure REST SQL++ Driver, 100% Native-Free)  
> **Security Model:** Zero-Knowledge Client-Side Credential Vault (Web Crypto API AES-GCM-256)  
> **Target Experience:** Microsoft 365 / Outlook Desktop & Web App (OWA) Enterprise Replica  

---

## 1. Executive Summary & Product Vision

This specification defines the architectural blueprint for an **enterprise-grade Email Client module** built directly into the ERP suite. The system delivers a seamless, pixel-perfect replica of **Microsoft Outlook (Web & Desktop Edition)**, combined with the zero-friction ergonomics of modern power-user email clients (Superhuman, Front).

### Core Pillars
1. **Desktop-Class Outlook Experience**: 3-pane resizable layout, Simplified Ribbon command bar, Focused/Other dual inbox, conversation threading, category tagging, drag-and-drop folder organization, and keyboard-first productivity.
2. **Zero-Knowledge Client-Side Credential Vault**: User email credentials (passwords, app-tokens, IMAP/SMTP secrets) are encrypted and managed exclusively on the client side using the **Web Crypto API (AES-GCM-256)**. The backend server never stores or has persistent access to unencrypted passwords.
3. **Couchbase Capella SQL++ Core**: High-throughput distributed document storage leveraging pure-JavaScript REST endpoints (`https://<host>:18093/query/service`). Zero native C++ binaries, ensuring 100% serverless and Vercel/Node 22/Node 24 compatibility.
4. **First-Class Contacts ("People" Module)**: Unified Address Book supporting an enterprise Global Address List (GAL) synced from ERP Users, MasterRoll workers, and Accounting Parties, plus Personal Contacts, Distribution Groups, and interaction-weighted auto-complete.
5. **Deep ERP Cross-Integration**: Direct two-way linking between emails and ERP entities: convert contractor quotation emails into Accounting Vouchers, link labour correspondence to MasterRoll workers, and attach auto-generated appointment letters or wage slips directly from the ERP document repository.

---

## 2. High-Level System Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENT BROWSER (NUXT 4)                               │
│                                                                                        │
│  ┌─────────────────────────────────┐      ┌─────────────────────────────────────────┐  │
│  │   Outlook Shell & UI Suite      │      │     Client-Side Web Crypto Vault        │  │
│  │  - 3-Pane Splitter (Folders,    │      │  - Master Passphrase / WebAuthn Key     │  │
│  │    Message List, Reading Pane)  │      │  - PBKDF2 / Argon2id Key Derivation     │  │
│  │  - Focused / Other Tabs         │      │  - AES-GCM-256 In-Memory Decryption    │  │
│  │  - Dockable Floating Composer   │      │  - IndexedDB Encrypted Key Ring         │  │
│  │  - People / Contacts Directory  │      │  - Ephemeral Session Payload Generator  │  │
│  │  - Sandboxed HTML Reader        │      └────────────────────┬────────────────────┘  │
│  └────────────────┬────────────────┘                           │                       │
└───────────────────┼────────────────────────────────────────────┼───────────────────────┘
                    │ HTTPS REST / WebSocket                     │ Ephemeral Auth Envelope
                    ▼                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                             NITRO SERVERLESS BACKEND (NODE.JS)                         │
│                                                                                        │
│  ┌───────────────────────────────┐              ┌───────────────────────────────────┐  │
│  │    Email Data Query Router    │              │   Ephemeral Mail Transport Proxy  │  │
│  │  - /api/mail/messages         │              │  - /api/mail/sync (IMAP worker)   │  │
│  │  - /api/mail/folders          │              │  - /api/mail/send (SMTP worker)   │  │
│  │  - /api/mail/threads          │              │  - Zero Persistence / Zero Log    │  │
│  │  - /api/mail/contacts         │              │  - Memory zeroing on exit         │  │
│  └───────────────┬───────────────┘              └─────────────────┬─────────────────┘  │
└──────────────────┼────────────────────────────────────────────────┼────────────────────┘
                   │ SQL++ REST (Port 18093)                        │ TLS Sockets (993/465/587)
                   ▼                                                ▼
┌──────────────────────────────────────┐       ┌────────────────────────────────────────┐
│      COUCHBASE CAPELLA CLOUD         │       │          EXTERNAL MAIL SERVERS         │
│                                      │       │                                        │
│  Bucket: `businesspro`               │       │  - Microsoft 365 / Exchange Online     │
│  Scope: `mail` (or `_default`)       │       │  - Google Workspace / Gmail (OAuth2)   │
│  Collections:                        │       │  - Corporate Zimbra / cPanel / Postfix │
│   ├─ `mail_accounts`                 │       │  - AWS SES / Zoho Mail / ProtonMail    │
│   ├─ `mail_folders`                  │       └────────────────────────────────────────┘
│   ├─ `mail_messages`                 │
│   ├─ `mail_threads`                  │
│   ├─ `mail_contacts` (NEW)           │
│   ├─ `mail_drafts`                   │
│   └─ `mail_rules`                    │
└──────────────────────────────────────┘
```

---

## 3. Zero-Knowledge Client-Side Credential Architecture

Standard web browsers cannot open raw TCP sockets directly to IMAP (port 993) or SMTP (port 465/587) due to browser sandbox restrictions. To fulfill the requirement that **user mail credentials remain on the client side**, the system implements a **Zero-Knowledge Ephemeral Bridge**.

### 3.1. Cryptographic Key Derivation & Storage

```
[User Master Key / Pin / Passkey]
                │
                ▼
       [PBKDF2 / Argon2id] (Salt: user_id + firm_id, 100,000 iterations)
                │
                ▼
      [AES-256-GCM Master Key]  <── Resides ONLY in browser runtime memory
                │
        ┌───────┴───────┐
        ▼               ▼
[Encrypt Credentials] [Decrypt Vault]
        │               ▲
        ▼               │
 [Ciphertext Blob in IndexedDB & Couchbase Backup]
 (Server CANNOT decrypt this blob)
```

1. **Client Vault Initialization**:
   - The user inputs their IMAP/SMTP credentials (Host, Port, Username, App Password, TLS preference) or connects via OAuth2.
   - The client browser generates a cryptographically secure random 256-bit salt.
   - Using `window.crypto.subtle`, an AES-GCM 256-bit encryption key is derived from the user's ERP session signature or a dedicated Mail PIN.
   - Credentials are encrypted into a compact ciphertext bundle:
     $$\text{Vault} = \text{IV} \,\|\, \text{AES-256-GCM}(\text{Plaintext Credentials}) \,\|\, \text{AuthTag}$$
   - The ciphertext is saved in local browser `IndexedDB`.
   - Optionally, an opaque copy of the ciphertext is synchronized to Couchbase (`mail_accounts.encryptedVaultBlob`). Because the server lacks the client-derived key, **the server has zero ability to decrypt it**.

2. **Ephemeral Mail Operations (Stateless Transport)**:
   - When the user triggers **Sync** or **Send Mail**:
     1. The browser decrypts the credentials in local memory.
     2. An ephemeral, single-use HTTPS payload is constructed with a short-lived cryptographic nonce (timestamp + 30s expiry).
     3. The payload is transmitted over HTTPS to the stateless Nitro endpoint (`/api/mail/sync` or `/api/mail/send`).
     4. The Nitro worker executes the IMAP/SMTP command in memory.
     5. The memory buffer holding the credentials is immediately overwritten/garbage collected.
     6. Nitro never logs, caches, or writes credentials to disk or database.

---

## 4. Couchbase Capella Data Modeling & SQL++ Architecture

### 4.1. Alignment with Existing Codebase Setup

The ERP already possesses a battle-tested Couchbase Capella integration:
1. **`server/plugins/couchbase.ts`**:
   - A non-blocking Nitro lifecycle plugin initialized during cold start.
   - Dispatches a 30-second safe keep-alive ping (`CouchbaseService.ping(30000)`).
   - Fully crash-proof: handles cold starts and missing environment variables gracefully without interrupting serverless requests.
2. **`server/utils/couchbase.ts`**:
   - Implements `CouchbaseService` using Node's native `node:https` agent with `keepAlive: true`, connecting directly to Capella's HTTPS REST Query Service on port **18093** (`https://${host}:18093/query/service`).
   - **Zero Native C++ Dependencies**: Works out-of-the-box on Windows, Linux, and Vercel serverless environments.
   - Employs SQL++ (N1QL) statements (`query()`, `ensureIndex()`, `saveMessage()`, `getMessage()`, `getHistory()`).
   - Configurable via `.env`:
     - `COUCHBASE_URL`
     - `COUCHBASE_USERNAME`
     - `COUCHBASE_PASSWORD`
     - `COUCHBASE_BUCKET` (default: `businesspro`)
     - `COUCHBASE_SCOPE` (default: `_default` or `mail`)
     - `COUCHBASE_COLLECTION` (default: `messages`)

### 4.2. Multi-Collection & Discriminator Strategy

To host both Mail and Contacts cleanly alongside existing Chat messages in Couchbase Capella, we support two architectural options:
- **Strategy A (Dedicated Collections)**: Within the `mail` scope or `_default` scope, create collections: `mail_accounts`, `mail_folders`, `mail_messages`, `mail_threads`, `mail_contacts`, `mail_drafts`, `mail_rules`.
- **Strategy B (Document Discriminator Pattern - Unified Collection)**: If running on Capella instances with single-collection quotas, documents share the collection and use a standard `type` discriminator:
  - `type: 'account'` (Key: `account::<firmId>::<accountId>`)
  - `type: 'folder'` (Key: `folder::<accountId>::<folderId>`)
  - `type: 'message'` (Key: `msg::<accountId>::<uid>`)
  - `type: 'thread'` (Key: `thread::<accountId>::<threadId>`)
  - `type: 'contact'` (Key: `contact::<firmId>::<userId>::<contactId>`)
  - `type: 'contact_group'` (Key: `group::<firmId>::<userId>::<groupId>`)

Both strategies leverage Couchbase secondary indexes (`CREATE INDEX ... WHERE type = '...'`) for zero-scan, lightning-fast queries.

---

### 4.3. Document Schemas

#### 1. `mail_accounts`
```typescript
interface MailAccountDoc {
  id: string; // e.g., "account::6a116b::user_101::work_mail"
  type: 'account';
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
  syncSettings: {
    syncIntervalMinutes: number;
    daysOfMailToKeep: number; // e.g. 90 days local cache
    syncFolders: string[]; // ["INBOX", "Sent", "Archive"]
  };
  encryptedVaultBlob?: string; // Opaque client-encrypted payload
  lastSyncAt: string | null;
  lastSyncStatus: 'SUCCESS' | 'ERROR' | 'SYNCING';
  lastSyncError?: string;
  createdAt: string;
  updatedAt: string;
}
```

#### 2. `mail_folders`
```typescript
interface MailFolderDoc {
  id: string; // e.g., "folder::acc_01::INBOX"
  type: 'folder';
  accountId: string;
  firmId: string;
  name: string; // e.g., "Inbox", "Subcontractors"
  path: string; // Full IMAP path: "INBOX/Subcontractors"
  delimiter: string; // "/"
  specialUse: 'INBOX' | 'SENT' | 'DRAFTS' | 'TRASH' | 'JUNK' | 'ARCHIVE' | 'USER';
  unreadCount: number;
  totalCount: number;
  uidValidity: number;
  highestModSeq?: string;
  color?: string; // Outlook folder color tag
  orderIndex: number;
  updatedAt: string;
}
```

#### 3. `mail_messages`
```typescript
interface MailMessageDoc {
  id: string; // e.g., "msg::acc_01::uid_4892"
  type: 'message';
  accountId: string;
  folderId: string;
  firmId: string;
  userId: string;
  uid: number; // IMAP Unique Identifier
  messageId: string; // RFC 2822 Message-ID
  threadId: string; // Deterministic conversation grouping ID
  subject: string;
  from: { name: string; address: string };
  to: Array<{ name: string; address: string }>;
  cc: Array<{ name: string; address: string }>;
  bcc: Array<{ name: string; address: string }>;
  replyTo: Array<{ name: string; address: string }>;
  date: string; // ISO-8601
  timestamp: number; // Unix epoch ms for B-Tree indexing & sorting
  snippet: string; // 180-character plaintext preview
  bodyHtml: string; // Sanitized HTML body
  bodyText: string; // Plaintext fallback
  hasAttachments: boolean;
  attachments: Array<{
    id: string;
    filename: string;
    contentType: string;
    size: number;
    contentId?: string; // For inline CID images
    storageUrl?: string; // Presigned URL or storage reference
  }>;
  flags: string[]; // ["\\Seen", "\\Flagged", "\\Answered"]
  isRead: boolean;
  isFlagged: boolean;
  isAnswered: boolean;
  importance: 'high' | 'normal' | 'low';
  tab: 'focused' | 'other'; // Outlook Focused Inbox classification
  categories: string[]; // ["Finance", "Site A", "Urgent"]
  erpLinks?: {
    masterRollWorkerId?: string;
    partyId?: string;
    voucherGroupId?: string;
    siteExpenseId?: string;
  };
  security: {
    spf: 'pass' | 'fail' | 'neutral' | 'unknown';
    dkim: 'pass' | 'fail' | 'unknown';
    dmarc: 'pass' | 'fail' | 'unknown';
    isExternal: boolean;
  };
  createdAt: string;
  updatedAt: string;
}
```

#### 4. `mail_threads`
```typescript
interface MailThreadDoc {
  id: string; // "thread::acc_01::<hash>"
  type: 'thread';
  accountId: string;
  firmId: string;
  subject: string;
  participantCount: number;
  participants: Array<{ name: string; address: string }>;
  messageCount: number;
  unreadCount: number;
  lastMessageTimestamp: number;
  snippet: string;
  hasAttachments: boolean;
  categories: string[];
  tab: 'focused' | 'other';
}
```

---

## 5. Enterprise Contacts & Address Book Architecture ("People" Module)

In Microsoft Outlook, **Contacts ("People")** is the central directory that powers the entire email experience, from instant auto-complete to interactive sender cards.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        UNIFIED OUTLOOK ADDRESS BOOK ARCHITECTURE                       │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│   ┌──────────────────────────────────────────────────────────────────────────────┐     │
│   │                 TIER 1: GLOBAL ADDRESS LIST (GAL - FIRM DIRECTORY)           │     │
│   │  - ERP Internal Users (`users` collection in MongoDB)                        │     │
│   │  - Parties, Vendors & Clients (`parties` collection in MongoDB)              │     │
│   │  - Labour Contractors & Leaders (`labor_leaders` in PG, `masterrolls` in DB) │     │
│   └──────────────────────────────────────┬───────────────────────────────────────┘     │
│                                          │ Auto-Linked & Unified                       │
│                                          ▼                                             │
│   ┌──────────────────────────────────────────────────────────────────────────────┐     │
│   │                 TIER 2: PERSONAL CONTACTS ("MY CONTACTS")                    │     │
│   │  - Stored in Couchbase (`type: 'contact'` documents)                         │     │
│   │  - Private to the user / shared within department                            │     │
│   │  - Full vCard (.vcf) & CSV import/export engine                              │     │
│   │  - Custom phone, address, notes, avatar, birthday, categories                │     │
│   └──────────────────────────────────────┬───────────────────────────────────────┘     │
│                                          │ Interaction Tracking                        │
│                                          ▼                                             │
│   ┌──────────────────────────────────────────────────────────────────────────────┐     │
│   │            TIER 3: AUTO-COLLECTED RECENT CONTACTS & FREQUENCY GRAPH          │     │
│   │  - Extracted automatically on every inbound & outbound email                 │     │
│   │  - Stores `emailCount` and `lastInteractionTimestamp`                       │     │
│   │  - Powers instant, sub-5ms Composer Auto-Complete (To, Cc, Bcc)              │     │
│   └──────────────────────────────────────┬───────────────────────────────────────┘     │
│                                          │ Grouping                                    │
│                                          ▼                                             │
│   ┌──────────────────────────────────────────────────────────────────────────────┐     │
│   │                 TIER 4: CONTACT GROUPS / DISTRIBUTION LISTS                  │     │
│   │  - E.g. "Site Engineers - Rangia", "Vendor Billing Leads", "Project Managers" │     │
│   │  - Expands into recipient arrays in Composer with 1 click                    │     │
│   └──────────────────────────────────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.1. Couchbase Contact Document Schema (`mail_contacts`)

```typescript
interface MailContactDoc {
  id: string; // "contact::<firmId>::<userId>::<contactId>"
  type: 'contact';
  firmId: string;
  userId: string; // Owning user ('GLOBAL' for firm-wide directory)
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
  categories: string[]; // ["Subcontractor", "Site B", "Supplier", "VIP"]
  source: 'PERSONAL' | 'GAL_SYNC' | 'AUTO_COLLECTED';
  isFavorite: boolean;
  interactionStats: {
    lastEmailedAt?: number;
    sentCount: number;
    receivedCount: number;
    frequencyScore: number; // Calculated weight for auto-complete ranking
  };
  erpLinks?: {
    userId?: string;
    partyId?: string;
    masterRollId?: string;
    laborLeaderId?: string;
  };
  createdAt: string;
  updatedAt: string;
}
```

#### Contact Group Document Schema (`mail_contact_groups`)
```typescript
interface MailContactGroupDoc {
  id: string; // "group::<firmId>::<userId>::<groupId>"
  type: 'contact_group';
  firmId: string;
  userId: string;
  name: string; // e.g. "Site Engineers - Rangia"
  description?: string;
  color?: string;
  members: Array<{
    name: string;
    email: string;
    contactId?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}
```

---

### 5.2. Outlook Contact Cards & Interactive vCard Popovers

Hovering over or clicking any sender or recipient chip in the **Message List** or **Reading Pane** displays the interactive **Outlook Contact Card**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [AVATAR]  RAJESH PATHAK                                         [★ Favorite]│
│           Labour Contractor & Gang Leader                                   │
│           rajesh.contractor@gmail.com • +91 98765 43210                     │
│                                                                             │
│ [QUICK ACTIONS]: [✉️ Send Email]  [💬 Chat (Internal)]  [📞 Call]  [✎ Edit] │
├─────────────────────────────────────────────────────────────────────────────┤
│ TABS: [ Overview ]   [ ERP Ledger ]   [ Email History ]   [ Organization ]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ ⚡ ERP CONTRACTOR SUMMARY:                                                  │
│   • Firm Stationing: Project ARR-GAGA MAINTAINANCE • Site: RANGIA           │
│   • Category: SKILLED LABOUR CONTRACTOR                                     │
│   • Active Work Period: 01 Oct 2026 - 31 Oct 2026                           │
│   • Pending Settlement: ₹87,750.00                                          │
│   [ Open Period Muster ]  [ View Worker Dossier ]  [ Issue Advance ]        │
├─────────────────────────────────────────────────────────────────────────────┤
│ RECENT CONVERSATIONS (Last 3):                                              │
│   • 10 Nov: Site B Excavation Progress & Mobilization Advance               │
│   • 02 Nov: Wage Muster Submission Oct 2026 (Verified)                      │
│   • 24 Oct: Bank Advance Payout Receipt Acknowledgment                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

1. **Instant Communication Actions**:
   - `Send Email`: Opens the floating `MailComposer.vue` pre-addressed to the contact.
   - `Chat`: Cross-launches the application's internal chat conversation using the existing `server/services/chatService.ts` and Upstash Redis.
2. **ERP Deep Context**:
   - Queries MongoDB `parties` or PostgreSQL `labor_leaders` to reveal real-time operational status (active site, outstanding advances, net payable balance).
3. **Recent Conversation History**:
   - Executes an indexed Couchbase SQL++ query retrieving all historical threads exchanged with this email address in < 20ms:
     ```sql
     SELECT m.id, m.subject, m.date, m.snippet 
     FROM `businesspro`.`_default`.`messages` m
     WHERE m.type = 'message' 
       AND m.firmId = $firmId
       AND (m.`from`.address = $contactEmail OR ANY r IN m.`to` SATISFIES r.address = $contactEmail END)
     ORDER BY m.timestamp DESC 
     LIMIT 5;
     ```

---

### 5.3. Composer Auto-Complete & Suggestion Engine

When typing in the `To:`, `Cc:`, or `Bcc:` fields in `MailComposer.vue`:
1. The client queries the cached local contacts store combined with the `/api/mail/contacts/suggest` endpoint.
2. SQL++ uses a prefix search:
   ```sql
   SELECT c.name, c.email, c.company, c.avatarUrl, c.interactionStats.frequencyScore
   FROM `businesspro`.`_default`.`messages` c
   WHERE c.type = 'contact'
     AND c.firmId = $firmId
     AND (LOWER(c.name) LIKE $prefix OR LOWER(c.email) LIKE $prefix)
   ORDER BY c.interactionStats.frequencyScore DESC, c.name ASC
   LIMIT 10;
   ```
3. Suggestions display the contact's avatar, full name, email, and ERP affiliation badge (e.g. `[Employee]`, `[Contractor]`, `[Vendor]`).

---

## 6. Outlook UI/UX Design System (Nuxt 4 + Nuxt UI v4)

The user interface reproduces the clean, high-density layout of **Microsoft Outlook 365 Web & Desktop**.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [APP RAIL]  [SIMPLIFIED RIBBON / COMMAND BAR: New Mail | Delete | Archive | Flag | Categorize | Sweep | Sync]         │
├───────────┬──────────────────────────────────────┬─────────────────────────────────────────────────────────────────────┤
│ MAIL      │ [SEARCH OUTLOOK: Current Folder  ▼]  │ [SUBJECT]: Site B Excavation Progress & Mobilization Advance        │
│ CALENDAR  │ Focused  |  Other                    │ From: Rajesh Pathak <rajesh.contractor@gmail.com>                   │
│ PEOPLE    ├──────────────────────────────────────┤ To: Accounts <accounts@infra.com>, Project Eng <eng@infra.com>      │
│ FILES     │ ● Rajesh Pathak        10:45 AM     │ Date: 10 Nov 2026, 10:45 AM    [⚡ External Sender] [DKIM: PASS]    │
│ SETTINGS  │   Site B Excavation Progress...      │ Categorized: [Site B] [Contractor]                                  │
│           │   Please find attached wage mu...    ├─────────────────────────────────────────────────────────────────────┤
│ ──FOLDERS─│                                      │ [ATTACHMENTS (2)]:                                                  │
│ ▼ Work    │ ○ Bank of India         09:15 AM     │ ┌──────────────────────┐  ┌──────────────────────┐                  │
│  Inbox 12 │   NEFT Credit Advice: ₹1,30,...      │ │ 📄 Wage_Muster.xlsx  │  │ 📑 RA_Bill_04.pdf    │                  │
│  Drafts 1 │   Your account has been credit...    │ │ 1.4 MB  [Preview]    │  │ 420 KB   [Preview]    │                  │
│  Sent     │                                      │ └──────────────────────┘  └──────────────────────┘                  │
│  Deleted  │ ● GST Portal          Yesterday      │                                                                     │
│  Archive  │   GSTR-2B Auto-Drafted State...      │ Dear Sir,                                                           │
│           │   Form GSTR-2B for the period ...    │                                                                     │
│ ──LABELS──│                                      │ Attached is the verified wage muster for site B. Please approve the │
│ 🟦 Site B │ ○ Metro Rail Engg     08 Nov 2026    │ mobilization advance against RA Bill 04.                            │
│ 🟩 Finance│   Joint Measurement Sheet Site B     │                                                                     │
│ 🟥 Urgent │   PFA signed joint measurement...    │ [ERP ACTIONS]: [Link to MasterRoll] [Create Advance Voucher]        │
└───────────┴──────────────────────────────────────┴─────────────────────────────────────────────────────────────────────┘
```

### 6.1. The Three-Pane Resizable Shell

1. **Leftmost Navigation Rail & Folder Pane (`MailFolderNav.vue`)**:
   - Multi-account switcher with status indicators (connected / syncing / auth required).
   - App Rail Switcher: **Mail**, **Calendar**, **People (Contacts)**, **Settings**.
   - Standard system folders with Lucide/Heroicon icons:
     - `Inbox` (with real-time unread counter badge)
     - `Drafts`
     - `Sent Items`
     - `Deleted Items` (Trash)
     - `Junk Email`
     - `Archive`
     - `Outbox` (with active upload queue progress)
   - Custom folders with collapsible tree hierarchy, right-click context menu (New Folder, Rename, Empty Folder, Color Code).
   - Drag-and-drop target: drag messages from the list directly into folders.

2. **Center Message List Pane (`MailListPane.vue`)**:
   - **Focused vs. Other Tabs**: Intelligent segmentation separating primary correspondence from automated receipts, notifications, and bulk updates.
   - Filter Chips: `All`, `Unread`, `Flagged`, `Mentions`, `Files`.
   - Sort Selector: Date, From, Subject, Size, Importance.
   - High-density message card (`MailListItem.vue`):
     - Unread blue indicator dot and bold font hierarchy.
     - Sender avatar with presence badge.
     - Subject and 2-line truncated snippet.
     - Attachment paperclip with count badge.
     - Color category pill badges.
     - Quick hover action toolbar (Delete, Archive, Flag, Mark Read/Unread).
   - Multi-select via Shift+Click / Cmd+Click with floating bulk-action command bar.

3. **Right Reading Pane (`MailReadingPane.vue`)**:
   - Header with full participant details (To, CC, BCC chips with hover vCard popovers).
   - Anti-phishing & Security Banner:
     - `External Sender` warning pill if sender domain is not part of the firm.
     - SPF, DKIM, and DMARC verification pills.
   - Attachment Tray:
     - Grid of attachment preview cards with MIME icons.
     - In-app preview modals for PDF (via `pdfjs-dist`), Excel/CSV (via `exceljs`), and images.
     - "Download All as ZIP" action.
   - Sandboxed HTML Reader:
     - Strict `iframe` sandbox (`sandbox="allow-same-origin"`) preventing script execution.
     - CSS isolation preventing host UI layout contamination.
     - Privacy shield: External images blocked by default with a banner ("Images in this email are hidden to protect your privacy. [Load Images]").

---

### 6.2. Dockable Floating Outlook Composer (`MailComposer.vue`)

The composer delivers an authentic Outlook Desktop composing experience:
- **Dockable Modes**:
  - Bottom-right minimized chip.
  - Bottom-right floating dock (Outlook default: `w-[640px] h-[520px]`).
  - Maximize to full-screen focused modal.
  - Pop-out to independent browser window.
- **Recipient Management**:
  - Auto-completing `To`, `CC`, and `BCC` fields with chip badges connected to the **Couchbase Contact Suggestion Engine**.
- **Rich Text WYSIWYG Editor**:
  - Powered by TipTap / Nuxt UI: Bold, Italic, Underline, Strikethrough, Color picker, Font family, Alignment, Bullet/Numbered lists, Tables, Blockquotes, Code snippets.
  - Inline image pasting from clipboard directly into the email body.
  - Drag-and-drop attachment dropzone with file size limit validation (25MB standard).
- **Enterprise Sending Controls**:
  - **Undo Send**: Configurable 5–10 second delay window with a toast snackbar ("Email sending in 5s... [Undo]").
  - **Schedule Send**: "Send Later" calendar picker.
  - **Importance Flagging**: High / Normal / Low priority headers (`X-Priority: 1`).
  - **Direct ERP Document Attachment**: Attach generated MasterRoll appointment letters, wage slips, or PDF ledgers straight from the database without intermediate local disk downloads.

---

## 7. IMAP/SMTP Synchronization Engine

### 7.1. Delta Synchronization Protocol (Fast & Incremental)

```
Client (Nuxt 4)            Nitro Server Proxy             Couchbase Capella         Mail Server (IMAP)
      │                            │                              │                         │
      │── 1. POST /api/mail/sync ──>│                              │                         │
      │   (Session + Decrypted     │                              │                         │
      │    Vault Payload)          │                              │                         │
      │                            │── 2. IMAP SELECT INBOX ───────────────────────────────>│
      │                            │<─ 3. Returns UIDVALIDITY & HIGHESTMODSEQ ──────────────│
      │                            │                              │                         │
      │                            │── 4. Query Couchbase Sync State ──>                    │
      │                            │<─ 5. Last known UID: 4850 ─────────                    │
      │                            │                              │                         │
      │                            │── 6. UID SEARCH UID 4851:* ───────────────────────────>│
      │                            │<─ 7. Returns [4851, 4852, 4853] ───────────────────────│
      │                            │                              │                         │
      │                            │── 8. UID FETCH 4851:4853 (FLAGS BODYSTRUCTURE) ────────>│
      │                            │<─ 9. Headers & Envelopes ──────────────────────────────│
      │                            │                              │                         │
      │                            │── 10. Upsert Messages Batch ─>                         │
      │                            │<─ 11. Success (SQL++ REST) ──                          │
      │                            │                              │                         │
      │<─ 12. Sync Complete ───────│                              │                         │
      │   (New: 3, Updated: 0)     │                              │                         │
```

1. **UIDVALIDITY Check**:
   - If the remote server's `UIDVALIDITY` matches Couchbase `mail_folders.uidValidity`, continue incremental sync.
   - If `UIDVALIDITY` has changed, purge folder cache and execute a fresh resync.
2. **Body Lazy-Loading**:
   - Initial synchronization fetches message envelopes (Subject, From, Date, Message-ID, Flags, Snippet).
   - Full HTML message bodies and attachments are fetched either on-demand when the user clicks the message, or prefetched in the background for the top 20 inbox items.
3. **IMAP IDLE Push Listener**:
   - An IMAP `IDLE` socket maintains an open connection. As soon as a new email arrives, the server triggers an event on the local Redis/SSE bus, updating the browser message list in real time.

---

### 7.2. SMTP Dispatch Engine

1. **RFC 822 MIME Generation**:
   - Generates compliant MIME messages with `text/plain`, `text/html`, and multipart attachment boundaries.
   - Assigns unique `Message-ID` (`<timestamp.random@firmdomain.com>`) and handles `In-Reply-To` and `References` headers to maintain RFC-compliant email threading.
2. **SMTP Submission**:
   - Connects to SMTP host using TLS/STARTTLS. Authenticates using the client-provided ephemeral credentials.
3. **IMAP Sent Items Append**:
   - Upon successful SMTP delivery, the exact sent MIME message is uploaded to the user's IMAP `Sent Items` folder via IMAP `APPEND`, ensuring mobile and desktop clients stay in sync.
4. **Couchbase Local Copy**:
   - Instantly upserts the message into Couchbase `mail_messages` under the `Sent` folder.

---

## 8. Deep ERP Cross-Module Integration

The true competitive advantage of having an embedded Outlook client inside this ERP is frictionless data flow across modules:

### 8.1. MasterRoll (Labour & Worker) Integration
- **Worker Matching**: The email client parses sender email addresses against `masterrolls.email` and `labor_leaders.phone/contact`.
- **Action Pill**: If an email is received from a registered contractor (e.g., Rajesh Pathak):
  - An ERP widget appears above the reading pane: `"Identified Contractor: RAJESH PATHAK • Active Period: 01 Oct 2026 - 31 Oct 2026"`.
  - One-click button: `"Open Period Muster"` or `"View Worker Dossier"`.

### 8.2. Unified Accounting System Integration
- **Invoice & Bill Conversion**: When a vendor emails a tax invoice (PDF or Excel):
  - One-click `"Convert to Payment Voucher"` button in the email reading pane.
  - Automatically extracts vendor name, invoice date, and total amount, pre-populating the ERP's `VoucherModal.vue`.
  - Links the originating `mail_messages.id` into the voucher's audit trail (`refType: 'EMAIL'`, `refId: msg.id`).

### 8.3. Direct Document Dispatch
- When generating appointment letters, salary slips, or ledger reports in the ERP:
  - Users can select `"Email via Outlook Client"`.
  - Spawns the floating `MailComposer.vue` pre-populated with the recipient's contact information and the generated PDF attached directly.

---

## 9. Step-by-Step Implementation Roadmap

The email module is organized into seven structured implementation phases:

### Phase 1: Database Foundation & Couchbase Mail Service
- [ ] Extend `server/utils/couchbase.ts` to support multi-collection SQL++ operations or deploy `server/utils/mail-couchbase.service.ts`.
- [ ] Create Couchbase collections / document types: `mail_accounts`, `mail_folders`, `mail_messages`, `mail_threads`, `mail_contacts`, `mail_drafts`, `mail_rules`.
- [ ] Deploy primary, secondary, and covering SQL++ indexes.
- [ ] Write integration test script `scripts/test-mail-couchbase.mjs` verifying document upsert, query, and FTS search.

### Phase 2: Client-Side Web Crypto Vault & Ephemeral Proxies
- [ ] Implement `app/composables/useMailVault.ts` using `window.crypto.subtle` (AES-GCM-256).
- [ ] Implement IndexedDB storage adapter for client-side encrypted credentials.
- [ ] Create ephemeral Nitro endpoints:
  - `server/api/mail/test-connection.post.ts`
  - `server/api/mail/sync.post.ts`
  - `server/api/mail/send.post.ts`
- [ ] Implement zero-logging and in-memory credential sanitization guarantees.

### Phase 3: Outlook UI Shell & Navigation Architecture
- [ ] Build `app/pages/mail/index.vue` with 3-pane resizable layout.
- [ ] Create `app/components/mail/MailRibbon.vue` (Simplified Ribbon command bar).
- [ ] Create `app/components/mail/MailFolderNav.vue` (Account tree, folder list, unread counters, drag targets).
- [ ] Add App Rail with **Mail** and **People (Contacts)** view toggling.
- [ ] Add account setup modal `app/components/mail/MailAccountModal.vue`.

### Phase 4: Message List & Focused Inbox Engine
- [ ] Build `app/components/mail/MailListPane.vue` with virtualized scrolling.
- [ ] Implement `Focused` vs. `Other` tab classification logic.
- [ ] Build `app/components/mail/MailListItem.vue` with hover actions, badges, and category tags.
- [ ] Implement multi-select, bulk delete, bulk archive, and mark-as-read actions.
- [ ] Integrate universal search bar with syntax filters (`from:`, `has:attachment`, `subject:`).

### Phase 5: Contacts ("People") Module & Suggestion Engine
- [ ] Create `server/api/mail/contacts/suggest.get.ts` for instant frequency-weighted auto-complete.
- [ ] Build `app/components/mail/MailContactCard.vue` (interactive vCard hover popover with ERP summary and conversation history).
- [ ] Create `app/pages/mail/contacts.vue` (Outlook People module: Contact cards, groups, import/export vCard).
- [ ] Build synchronization job linking MongoDB `users`, `parties`, and PostgreSQL `labor_leaders` into the Global Address List.

### Phase 6: Reading Pane, Thread View & Sandboxed HTML Viewer
- [ ] Build `app/components/mail/MailReadingPane.vue`.
- [ ] Implement conversation threading (`mail_threads`) with chronological reply cards.
- [ ] Implement sandboxed `<iframe>` email viewer with external image blocking shield.
- [ ] Implement attachment viewer tray with instant PDF/Excel previews.

### Phase 7: Floating Composer, ERP Linking & Production Hardening
- [ ] Build `app/components/mail/MailComposer.vue` (TipTap rich text, clipboard image paste, recipient chips).
- [ ] Implement "Undo Send" 5-second grace period snackbar.
- [ ] Implement ERP cross-linking widgets (MasterRoll contractor matching, Voucher creation).
- [ ] Complete keyboard shortcut navigation matrix (J/K next/prev, E archive, # delete, R reply, C compose).
- [ ] Perform full TypeScript (`vue-tsc`, `tsc`) and security audit.

---

## 10. Security, Privacy & Regulatory Compliance

1. **Zero-Trust Client Key Management**: Passwords are never sent across network boundaries except during transient, encrypted IMAP/SMTP transport sessions.
2. **HTML Sanitization & CSP**:
   - All email HTML bodies are sanitized with `xss` on arrival.
   - Rendered inside sandboxed iframes with `sandbox="allow-same-origin"` and explicit Content Security Policy preventing unauthorized script execution or cookie theft.
3. **Phishing & External Threat Mitigation**:
   - Senders outside the firm's domain are marked with a prominent amber `External Sender` pill.
   - Remote tracking pixels and external image assets are blocked until the user explicitly clicks "Load Images".
4. **Data Isolation & Multi-Tenancy**:
   - Every Couchbase query strictly enforces `firmId = $firmId AND userId = $userId`, preventing data leakage across firms or users.

---

*This architectural blueprint serves as the official design authority for the Enterprise Outlook Email Client module within the ERP application.*
