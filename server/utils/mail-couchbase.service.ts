import { CouchbaseService } from './couchbase';
import type { MailAccount, MailFolder, MailMessage, MailThread, MailContact } from '../../app/types/mail';

let isMailIndexProvisioned = false;

export class MailCouchbaseService {
  private static getCfg() {
    const rawUrl = process.env.COUCHBASE_URL;
    const username = process.env.COUCHBASE_USERNAME;
    const password = process.env.COUCHBASE_PASSWORD;
    const bucket = process.env.COUCHBASE_BUCKET || 'anjan';
    const scope = process.env.COUCHBASE_SCOPE || '_default';
    const collection = process.env.COUCHBASE_COLLECTION || 'messages';
    return { rawUrl, username, password, bucket, scope, collection };
  }

  /**
   * Ensure secondary and covering indexes exist for the Mail module
   */
  static async ensureIndexes(): Promise<void> {
    if (isMailIndexProvisioned) return;
    const { bucket, scope, collection } = this.getCfg();
    const table = `\`${bucket}\`.\`${scope}\`.\`${collection}\``;

    try {
      await CouchbaseService.query(`CREATE PRIMARY INDEX IF NOT EXISTS ON ${table}`);
      await CouchbaseService.query(`
        CREATE INDEX IF NOT EXISTS idx_mail_messages_listing 
        ON ${table} (firmId, accountId, folderId, tab, timestamp DESC)
        WHERE type = 'message'
      `);
      await CouchbaseService.query(`
        CREATE INDEX IF NOT EXISTS idx_mail_threads_lookup 
        ON ${table} (firmId, accountId, threadId, timestamp ASC)
        WHERE type = 'message'
      `);
      await CouchbaseService.query(`
        CREATE INDEX IF NOT EXISTS idx_mail_contacts_search 
        ON ${table} (firmId, userId, name, email)
        WHERE type = 'contact'
      `);
      isMailIndexProvisioned = true;
    } catch (err: any) {
      console.warn('[MailCouchbase] Index provisioning notice:', err?.message || err);
    }
  }

  // -------------------------------------------------------------
  // Accounts
  // -------------------------------------------------------------
  static async getAccounts(firmId: string, userId: string): Promise<MailAccount[]> {
    const { bucket, scope, collection } = this.getCfg();
    await this.ensureIndexes();

    const stmt = `
      SELECT m.* FROM \`${bucket}\`.\`${scope}\`.\`${collection}\` m
      WHERE m.type = 'account' AND m.firmId = $firmId AND (m.userId = $userId OR m.userId = 'GLOBAL')
      ORDER BY m.emailAddress ASC
    `;
    const res = await CouchbaseService.query(stmt, { $firmId: firmId, $userId: userId });
    return (res.status === 'success' && res.results) ? res.results : [];
  }

  static async saveAccount(account: MailAccount): Promise<boolean> {
    const { bucket, scope, collection } = this.getCfg();
    await this.ensureIndexes();

    const docKey = `account::${account.firmId}::${account.id}`;
    const payload = { ...account, type: 'account', updatedAt: new Date().toISOString() };
    const stmt = `UPSERT INTO \`${bucket}\`.\`${scope}\`.\`${collection}\` (KEY, VALUE) VALUES ($docKey, $doc)`;

    const res = await CouchbaseService.query(stmt, { $docKey: docKey, $doc: payload });
    return res.status === 'success';
  }

  // -------------------------------------------------------------
  // Folders
  // -------------------------------------------------------------
  static async getFolders(accountId: string, firmId: string): Promise<MailFolder[]> {
    const { bucket, scope, collection } = this.getCfg();
    await this.ensureIndexes();

    const stmt = `
      SELECT m.* FROM \`${bucket}\`.\`${scope}\`.\`${collection}\` m
      WHERE m.type = 'folder' AND m.firmId = $firmId AND m.accountId = $accountId
      ORDER BY m.orderIndex ASC, m.name ASC
    `;
    const res = await CouchbaseService.query(stmt, { $firmId: firmId, $accountId: accountId });
    return (res.status === 'success' && res.results) ? res.results : [];
  }

  static async saveFolder(folder: MailFolder): Promise<boolean> {
    const { bucket, scope, collection } = this.getCfg();
    await this.ensureIndexes();

    const docKey = `folder::${folder.accountId}::${folder.id}`;
    const payload = { ...folder, type: 'folder', updatedAt: new Date().toISOString() };
    const stmt = `UPSERT INTO \`${bucket}\`.\`${scope}\`.\`${collection}\` (KEY, VALUE) VALUES ($docKey, $doc)`;

    const res = await CouchbaseService.query(stmt, { $docKey: docKey, $doc: payload });
    return res.status === 'success';
  }

  // -------------------------------------------------------------
  // Messages & Threads
  // -------------------------------------------------------------
  static async getMessages(params: {
    firmId: string;
    accountId: string;
    folderId?: string;
    tab?: 'focused' | 'other';
    filter?: 'all' | 'unread' | 'flagged' | 'files';
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ messages: MailMessage[]; total: number }> {
    const { bucket, scope, collection } = this.getCfg();
    await this.ensureIndexes();

    const limit = params.limit || 50;
    const offset = params.offset || 0;
    const conds: string[] = ["m.type = 'message'", "m.firmId = $firmId", "m.accountId = $accountId"];
    const queryParams: Record<string, any> = {
      $firmId: params.firmId,
      $accountId: params.accountId,
      $limit: limit,
      $offset: offset
    };

    if (params.folderId) {
      conds.push("m.folderId = $folderId");
      queryParams.$folderId = params.folderId;
    }
    if (params.tab && (!params.folderId || params.folderId.toUpperCase() === 'INBOX')) {
      conds.push("m.tab = $tab");
      queryParams.$tab = params.tab;
    }
    if (params.filter === 'unread') {
      conds.push("m.isRead = false");
    } else if (params.filter === 'flagged') {
      conds.push("m.isFlagged = true");
    } else if (params.filter === 'files') {
      conds.push("m.hasAttachments = true");
    }
    if (params.search && params.search.trim()) {
      conds.push("(LOWER(m.subject) LIKE $search OR LOWER(m.`from`.address) LIKE $search OR LOWER(m.`from`.name) LIKE $search OR LOWER(m.snippet) LIKE $search)");
      queryParams.$search = `%${params.search.trim().toLowerCase()}%`;
    }

    const whereClause = conds.join(' AND ');
    const stmt = `
      SELECT m.* FROM \`${bucket}\`.\`${scope}\`.\`${collection}\` m
      WHERE ${whereClause}
      ORDER BY m.timestamp DESC
      LIMIT $limit OFFSET $offset
    `;

    const countStmt = `
      SELECT COUNT(1) as total FROM \`${bucket}\`.\`${scope}\`.\`${collection}\` m
      WHERE ${whereClause}
    `;

    const [listRes, countRes] = await Promise.all([
      CouchbaseService.query(stmt, queryParams),
      CouchbaseService.query(countStmt, queryParams)
    ]);

    const messages = (listRes.status === 'success' && listRes.results) ? listRes.results : [];
    const total = countRes.results?.[0]?.total || messages.length;

    return { messages, total };
  }

  static async getMessage(id: string): Promise<MailMessage | null> {
    const { bucket, scope, collection } = this.getCfg();
    const docKey = id.startsWith('msg::') ? id : `msg::${id}`;
    const stmt = `SELECT m.* FROM \`${bucket}\`.\`${scope}\`.\`${collection}\` m USE KEYS ($docKey)`;
    const res = await CouchbaseService.query(stmt, { $docKey: docKey });
    if (res.status === 'success' && res.results && res.results.length > 0) {
      return res.results[0];
    }
    return null;
  }

  static async saveMessage(msg: MailMessage): Promise<boolean> {
    const { bucket, scope, collection } = this.getCfg();
    await this.ensureIndexes();

    const docKey = msg.id.startsWith('msg::') ? msg.id : `msg::${msg.accountId}::${msg.uid || Date.now()}`;
    const payload = { ...msg, id: docKey, type: 'message', updatedAt: new Date().toISOString() };
    const stmt = `UPSERT INTO \`${bucket}\`.\`${scope}\`.\`${collection}\` (KEY, VALUE) VALUES ($docKey, $doc)`;

    const res = await CouchbaseService.query(stmt, { $docKey: docKey, $doc: payload });
    return res.status === 'success';
  }

  static async updateMessageFlags(id: string, updates: {
    isRead?: boolean;
    isFlagged?: boolean;
    categories?: string[];
    folderId?: string;
  }): Promise<boolean> {
    const { bucket, scope, collection } = this.getCfg();
    const docKey = id.startsWith('msg::') ? id : `msg::${id}`;

    const setClauses: string[] = ["updatedAt = $now"];
    const params: Record<string, any> = { $docKey: docKey, $now: new Date().toISOString() };

    if (updates.isRead !== undefined) {
      setClauses.push("isRead = $isRead");
      params.$isRead = updates.isRead;
    }
    if (updates.isFlagged !== undefined) {
      setClauses.push("isFlagged = $isFlagged");
      params.$isFlagged = updates.isFlagged;
    }
    if (updates.categories !== undefined) {
      setClauses.push("categories = $categories");
      params.$categories = updates.categories;
    }
    if (updates.folderId !== undefined) {
      setClauses.push("folderId = $folderId");
      params.$folderId = updates.folderId;
    }

    const stmt = `
      UPDATE \`${bucket}\`.\`${scope}\`.\`${collection}\`
      SET ${setClauses.join(', ')}
      WHERE META().id = $docKey AND type = 'message'
    `;

    const res = await CouchbaseService.query(stmt, params);
    return res.status === 'success';
  }

  static async getThreadMessages(accountId: string, threadId: string): Promise<MailMessage[]> {
    const { bucket, scope, collection } = this.getCfg();
    const stmt = `
      SELECT m.* FROM \`${bucket}\`.\`${scope}\`.\`${collection}\` m
      WHERE m.type = 'message' AND m.accountId = $accountId AND m.threadId = $threadId
      ORDER BY m.timestamp ASC
    `;
    const res = await CouchbaseService.query(stmt, { $accountId: accountId, $threadId: threadId });
    return (res.status === 'success' && res.results) ? res.results : [];
  }

  // -------------------------------------------------------------
  // Contacts & People Module
  // -------------------------------------------------------------
  static async getContacts(firmId: string, userId: string, search?: string, limit = 50): Promise<MailContact[]> {
    const { bucket, scope, collection } = this.getCfg();
    await this.ensureIndexes();

    const conds: string[] = ["m.type = 'contact'", "m.firmId = $firmId", "(m.userId = $userId OR m.userId = 'GLOBAL')"];
    const params: Record<string, any> = { $firmId: firmId, $userId: userId, $limit: limit };

    if (search && search.trim()) {
      conds.push("(LOWER(m.name) LIKE $search OR LOWER(m.email) LIKE $search OR LOWER(m.company) LIKE $search)");
      params.$search = `%${search.trim().toLowerCase()}%`;
    }

    const stmt = `
      SELECT m.* FROM \`${bucket}\`.\`${scope}\`.\`${collection}\` m
      WHERE ${conds.join(' AND ')}
      ORDER BY m.interactionStats.frequencyScore DESC, m.name ASC
      LIMIT $limit
    `;

    const res = await CouchbaseService.query(stmt, params);
    return (res.status === 'success' && res.results) ? res.results : [];
  }

  static async saveContact(contact: MailContact): Promise<boolean> {
    const { bucket, scope, collection } = this.getCfg();
    await this.ensureIndexes();

    const cleanEmail = (contact.email || '').toLowerCase().trim();
    const docKey = contact.id || `contact::${contact.firmId}::${contact.userId}::${cleanEmail}`;
    const payload = {
      ...contact,
      id: docKey,
      type: 'contact',
      email: cleanEmail,
      updatedAt: new Date().toISOString()
    };
    const stmt = `UPSERT INTO \`${bucket}\`.\`${scope}\`.\`${collection}\` (KEY, VALUE) VALUES ($docKey, $doc)`;

    const res = await CouchbaseService.query(stmt, { $docKey: docKey, $doc: payload });
    return res.status === 'success';
  }

  /**
   * Auto-collect contact from inbound or outbound email to train the suggestion engine
   */
  static async autoCollectContact(firmId: string, userId: string, address: { name: string; address: string }): Promise<void> {
    if (!address.address || !address.address.includes('@')) return;
    const cleanEmail = address.address.toLowerCase().trim();
    const { bucket, scope, collection } = this.getCfg();

    const docKey = `contact::${firmId}::${userId}::${cleanEmail}`;
    const selectStmt = `SELECT m.* FROM \`${bucket}\`.\`${scope}\`.\`${collection}\` m USE KEYS ($docKey)`;
    const checkRes = await CouchbaseService.query(selectStmt, { $docKey: docKey });

    const now = Date.now();
    if (checkRes.status === 'success' && checkRes.results && checkRes.results[0]) {
      const existing = checkRes.results[0];
      const stats = existing.interactionStats || { sentCount: 0, receivedCount: 0, frequencyScore: 0 };
      stats.sentCount = (stats.sentCount || 0) + 1;
      stats.frequencyScore = (stats.frequencyScore || 0) + 1;
      stats.lastEmailedAt = now;

      const updateStmt = `
        UPDATE \`${bucket}\`.\`${scope}\`.\`${collection}\`
        SET interactionStats = $stats, updatedAt = $nowIso
        WHERE META().id = $docKey
      `;
      await CouchbaseService.query(updateStmt, { $stats: stats, $nowIso: new Date().toISOString(), $docKey: docKey });
    } else {
      const newContact: MailContact = {
        id: docKey,
        type: 'contact',
        firmId,
        userId,
        name: address.name || cleanEmail.split('@')[0] || 'Unknown',
        email: cleanEmail,
        categories: [],
        source: 'AUTO_COLLECTED',
        isFavorite: false,
        interactionStats: {
          lastEmailedAt: now,
          sentCount: 1,
          receivedCount: 0,
          frequencyScore: 1
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await this.saveContact(newContact);
    }
  }
}

