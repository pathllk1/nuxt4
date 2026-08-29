import { connect, Cluster, Bucket, Scope, Collection } from 'couchbase';

let clusterInstance: Cluster | null = null;
let bucketInstance: Bucket | null = null;
let collectionInstance: Collection | null = null;
let isProvisioning = false;

/**
 * Get or establish the Couchbase Capella Collection instance.
 * Automatically provisions scope, collection and SQL++ indexes if they do not exist,
 * with graceful fallback to bucket.defaultCollection().
 */
export async function getCouchbaseCollection(): Promise<Collection | null> {
  if (collectionInstance) {
    return collectionInstance;
  }

  const url = process.env.COUCHBASE_URL;
  const username = process.env.COUCHBASE_USERNAME;
  const password = process.env.COUCHBASE_PASSWORD;
  const bucketName = process.env.COUCHBASE_BUCKET || 'businesspro';
  const scopeName = process.env.COUCHBASE_SCOPE || '_default';
  const collectionName = process.env.COUCHBASE_COLLECTION || 'messages';

  if (!url || !username || !password) {
    console.warn('[Couchbase] Credentials not found in environment (COUCHBASE_URL, COUCHBASE_USERNAME, COUCHBASE_PASSWORD).');
    return null;
  }

  if (!clusterInstance) {
    try {
      clusterInstance = await connect(url, {
        username,
        password,
        timeouts: {
          connectTimeout: 30000,
          kvTimeout: 20000,
          queryTimeout: 25000
        }
      });
      console.log(`[Couchbase] Successfully connected to Capella cluster: ${url}`);
    } catch (err: any) {
      clusterInstance = null;
      console.error('[Couchbase] Connection error:', err.message);
      return null;
    }
  }

  bucketInstance = clusterInstance.bucket(bucketName);

  // Auto-provision scope & collection if not already running
  if (!isProvisioning) {
    isProvisioning = true;
    try {
      await ensureScopeAndCollection(bucketInstance, scopeName, collectionName);
    } catch (err: any) {
      console.warn('[Couchbase] Provisioning notice:', err.message);
    } finally {
      isProvisioning = false;
    }
  }

  try {
    const scope: Scope = bucketInstance.scope(scopeName);
    collectionInstance = scope.collection(collectionName);
  } catch (err) {
    console.warn(`[Couchbase] Scope/Collection "${scopeName}.${collectionName}" unavailable, falling back to default collection:`, err);
    collectionInstance = bucketInstance.defaultCollection();
  }

  return collectionInstance;
}

/**
 * Ensures the target scope and collection exist in Couchbase Capella.
 * If collection is missing, it auto-creates it and provisions necessary SQL++ indexes.
 */
async function ensureScopeAndCollection(bucket: Bucket, scopeName: string, collectionName: string): Promise<void> {
  if (scopeName === '_default' && collectionName === '_default') {
    return;
  }

  try {
    const collectionManager = bucket.collections();
    const scopes = await collectionManager.getAllScopes();
    let targetScope = scopes.find(s => s.name === scopeName);

    // 1. Create scope if missing
    if (!targetScope && scopeName !== '_default') {
      console.log(`[Couchbase] Scope "${scopeName}" not found. Creating scope...`);
      try {
        await collectionManager.createScope(scopeName);
        const updatedScopes = await collectionManager.getAllScopes();
        targetScope = updatedScopes.find(s => s.name === scopeName);
      } catch (scopeErr: any) {
        if (!scopeErr.message?.includes('already exists')) {
          throw scopeErr;
        }
      }
    }

    // 2. Create collection if missing
    const collectionExists = targetScope?.collections.some(c => c.name === collectionName);
    if (!collectionExists && collectionName !== '_default') {
      console.log(`[Couchbase] Collection "${collectionName}" not found in scope "${scopeName}". Creating collection...`);
      await collectionManager.createCollection({ name: collectionName, scopeName });
      console.log(`[Couchbase] Collection "${collectionName}" created successfully.`);

      // 3. Auto-provision SQL++ indexes
      await provisionIndexes(bucket.name, scopeName, collectionName);
    }
  } catch (err: any) {
    console.warn(`[Couchbase] Collection auto-provision notice (${scopeName}.${collectionName}): ${err.message}. Will use default collection.`);
  }
}

/**
 * Provisions required SQL++ indexes for deep message history queries
 */
async function provisionIndexes(bucket: string, scope: string, collection: string): Promise<void> {
  if (!clusterInstance) return;
  try {
    console.log(`[Couchbase] Provisioning SQL++ indexes on \`${bucket}\`.\`${scope}\`.\`${collection}\`...`);
    await clusterInstance.query(
      `CREATE PRIMARY INDEX IF NOT EXISTS ON \`${bucket}\`.\`${scope}\`.\`${collection}\``
    );
    await clusterInstance.query(
      `CREATE INDEX IF NOT EXISTS \`ix_chat_messages_chatId_timestamp\` ON \`${bucket}\`.\`${scope}\`.\`${collection}\`(\`chatId\`, \`timestamp\` DESC) WHERE \`type\` = 'message'`
    );
    await clusterInstance.query(
      `CREATE INDEX IF NOT EXISTS \`ix_chat_messages_recipient_status\` ON \`${bucket}\`.\`${scope}\`.\`${collection}\`(\`recipientId\`, \`status\`) WHERE \`type\` = 'message'`
    );
    console.log(`[Couchbase] SQL++ indexes ready.`);
  } catch (indexErr: any) {
    console.warn(`[Couchbase] Index creation notice: ${indexErr.message}`);
  }
}

export class CouchbaseService {
  /**
   * Save message to Couchbase Capella permanent storage
   */
  static async saveMessage(messageDoc: any): Promise<void> {
    const collection = await getCouchbaseCollection();
    if (!collection) {
      console.warn('[Couchbase] Skipping saveMessage — Couchbase collection not available');
      return;
    }
    const docKey = `message::${messageDoc.messageId}`;
    await collection.upsert(docKey, messageDoc);
  }

  /**
   * Get single message by ID from Couchbase Capella
   */
  static async getMessage(messageId: string): Promise<any | null> {
    const collection = await getCouchbaseCollection();
    if (!collection) return null;
    try {
      const result = await collection.get(`message::${messageId}`);
      return result.content;
    } catch (err: any) {
      if (err.name === 'DocumentNotFoundError' || err.message?.includes('not found')) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Toggle reaction on a message in Couchbase Capella
   */
  static async updateReaction(messageId: string, emoji: string, userId: string): Promise<Record<string, string[]>> {
    const collection = await getCouchbaseCollection();
    if (!collection) return {};

    const docKey = `message::${messageId}`;
    const docResult = await collection.get(docKey);
    const msg = docResult.content;

    const reactions: Record<string, string[]> = msg.reactions || {};
    const users: string[] = reactions[emoji] || [];
    const index = users.indexOf(userId);

    if (index > -1) {
      users.splice(index, 1);
      if (users.length === 0) {
        delete reactions[emoji];
      } else {
        reactions[emoji] = users;
      }
    } else {
      users.push(userId);
      reactions[emoji] = users;
    }

    msg.reactions = reactions;
    await collection.replace(docKey, msg);
    return reactions;
  }

  /**
   * Update message status (e.g. read or delivered)
   */
  static async updateStatus(chatId: string, recipientId: string, status: 'read' | 'delivered'): Promise<void> {
    const collection = await getCouchbaseCollection();
    if (!collection || !clusterInstance) return;

    const bucketName = process.env.COUCHBASE_BUCKET || 'businesspro';
    const scopeName = process.env.COUCHBASE_SCOPE || '_default';
    const collectionName = process.env.COUCHBASE_COLLECTION || 'messages';

    const query = `
      UPDATE \`${bucketName}\`.\`${scopeName}\`.\`${collectionName}\`
      SET status = $status, readAt = $now
      WHERE type = 'message' AND chatId = $chatId AND recipientId = $recipientId AND status != 'read'
    `;

    try {
      await clusterInstance.query(query, {
        parameters: { status, now: Date.now(), chatId, recipientId }
      });
    } catch (err: any) {
      console.warn('[Couchbase] Status update query notice:', err.message);
    }
  }

  /**
   * Deep historical pagination query using Couchbase SQL++
   */
  static async getHistory(chatId: string, beforeTimestamp: number, limit = 30): Promise<any[]> {
    const collection = await getCouchbaseCollection();
    if (!collection || !clusterInstance) return [];

    const bucketName = process.env.COUCHBASE_BUCKET || 'businesspro';
    const scopeName = process.env.COUCHBASE_SCOPE || '_default';
    const collectionName = process.env.COUCHBASE_COLLECTION || 'messages';

    const query = `
      SELECT m.* FROM \`${bucketName}\`.\`${scopeName}\`.\`${collectionName}\` m
      WHERE m.type = 'message' AND m.chatId = $chatId AND m.timestamp < $beforeTimestamp
      ORDER BY m.timestamp DESC
      LIMIT $limit
    `;

    try {
      const result = await clusterInstance.query(query, {
        parameters: { chatId, beforeTimestamp, limit }
      });
      return result.rows || [];
    } catch (err: any) {
      console.warn('[Couchbase] History query notice:', err.message);
      return [];
    }
  }
}
