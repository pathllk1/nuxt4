import https from 'node:https';
import type { ChatMessage } from '../../app/types/chat';

// Reusable HTTPS agent for Couchbase Capella REST Query Service
const agent = new https.Agent({
  rejectUnauthorized: false, // Compatibility with Capella TLS certificate chain
  keepAlive: true,
  timeout: 10000
});

let isIndexProvisioned = false;

interface CouchbaseQueryResponse {
  requestID: string;
  status: 'success' | 'fatal' | 'errors';
  results?: any[];
  errors?: Array<{ code: number; msg: string }>;
}

export class CouchbaseService {
  private static getEndpoint(): { url: string; authHeader: string; bucket: string; scope: string; collection: string } | null {
    const rawUrl = process.env.COUCHBASE_URL;
    const username = process.env.COUCHBASE_USERNAME;
    const password = process.env.COUCHBASE_PASSWORD;
    const bucket = process.env.COUCHBASE_BUCKET || 'businesspro';
    const scope = process.env.COUCHBASE_SCOPE || '_default';
    const collection = process.env.COUCHBASE_COLLECTION || 'messages';

    if (!rawUrl || !username || !password) {
      return null;
    }

    // Extract hostname from couchbases:// or https:// URL
    const match = rawUrl.match(/^(?:couchbases?:\/\/|https?:\/\/)?([^/?#:]+)/);
    const host = match ? match[1] : rawUrl;
    const endpointUrl = `https://${host}:18093/query/service`;
    const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

    return { url: endpointUrl, authHeader, bucket, scope, collection };
  }

  /**
   * Execute SQL++ statement via Couchbase Capella HTTPS Query Service
   * 100% pure JavaScript - 0 native C++ dependencies (fully Vercel / Linux compatible)
   */
  static async query(statement: string, params: Record<string, any> = {}): Promise<CouchbaseQueryResponse> {
    const cfg = this.getEndpoint();
    if (!cfg) {
      return { requestID: '', status: 'fatal', errors: [{ code: 0, msg: 'Couchbase credentials not configured' }] };
    }

    const postData = JSON.stringify({ statement, ...params });

    return new Promise((resolve) => {
      const req = https.request(cfg.url, {
        method: 'POST',
        agent,
        headers: {
          'Authorization': cfg.authHeader,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body) as CouchbaseQueryResponse;
            resolve(parsed);
          } catch {
            resolve({ requestID: '', status: 'fatal', errors: [{ code: res.statusCode || 500, msg: body }] });
          }
        });
      });

      req.on('error', (err) => {
        resolve({ requestID: '', status: 'fatal', errors: [{ code: 500, msg: err.message }] });
      });

      req.setTimeout(8000, () => {
        req.destroy(new Error('Couchbase query timeout'));
        resolve({ requestID: '', status: 'fatal', errors: [{ code: 408, msg: 'Query timeout' }] });
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Ensure primary index exists on collection (executed once on startup)
   */
  private static async ensureIndex(): Promise<void> {
    if (isIndexProvisioned) return;
    const cfg = this.getEndpoint();
    if (!cfg) return;

    try {
      await this.query(`CREATE PRIMARY INDEX IF NOT EXISTS ON \`${cfg.bucket}\`.\`${cfg.scope}\`.\`${cfg.collection}\``);
      isIndexProvisioned = true;
    } catch {
      // Non-critical
    }
  }

  /**
   * Save message to permanent archive
   */
  static async saveMessage(messageDoc: ChatMessage): Promise<void> {
    const cfg = this.getEndpoint();
    if (!cfg) return;

    await this.ensureIndex();
    const docKey = `message::${messageDoc.messageId}`;
    const statement = `UPSERT INTO \`${cfg.bucket}\`.\`${cfg.scope}\`.\`${cfg.collection}\` (KEY, VALUE) VALUES ($docKey, $doc)`;

    const res = await this.query(statement, {
      $docKey: docKey,
      $doc: messageDoc
    });

    if (res.status !== 'success') {
      console.warn('[Couchbase REST] Upsert notice:', res.errors?.[0]?.msg || res.status);
    }
  }

  /**
   * Get single message by ID
   */
  static async getMessage(messageId: string): Promise<any | null> {
    const cfg = this.getEndpoint();
    if (!cfg) return null;

    const docKey = `message::${messageId}`;
    const statement = `SELECT m.* FROM \`${cfg.bucket}\`.\`${cfg.scope}\`.\`${cfg.collection}\` m USE KEYS ($docKey)`;

    const res = await this.query(statement, { $docKey: docKey });
    if (res.status === 'success' && res.results && res.results.length > 0) {
      return res.results[0];
    }
    return null;
  }

  /**
   * Toggle reaction on a message
   */
  static async updateReaction(messageId: string, emoji: string, userId: string): Promise<Record<string, string[]>> {
    const msg = await this.getMessage(messageId);
    if (!msg) return {};

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

    const cfg = this.getEndpoint();
    if (cfg) {
      const docKey = `message::${messageId}`;
      const statement = `UPSERT INTO \`${cfg.bucket}\`.\`${cfg.scope}\`.\`${cfg.collection}\` (KEY, VALUE) VALUES ($docKey, $doc)`;
      await this.query(statement, { $docKey: docKey, $doc: msg });
    }

    return reactions;
  }

  /**
   * Update message status (e.g. read or delivered)
   */
  static async updateStatus(chatId: string, recipientId: string, status: 'read' | 'delivered'): Promise<void> {
    const cfg = this.getEndpoint();
    if (!cfg) return;

    const statement = `
      UPDATE \`${cfg.bucket}\`.\`${cfg.scope}\`.\`${cfg.collection}\`
      SET status = $status, readAt = $now
      WHERE type = 'message' AND chatId = $chatId AND recipientId = $recipientId AND status != 'read'
    `;

    await this.query(statement, {
      $status: status,
      $now: Date.now(),
      $chatId: chatId,
      $recipientId: recipientId
    });
  }

  /**
   * Mark message as deleted in Couchbase Capella
   */
  static async deleteMessage(messageId: string): Promise<boolean> {
    const cfg = this.getEndpoint();
    if (!cfg) return false;

    const statement = `
      UPDATE \`${cfg.bucket}\`.\`${cfg.scope}\`.\`${cfg.collection}\`
      SET isDeleted = true, content = 'This message was deleted', reactions = {}, deletedAt = $now
      WHERE type = 'message' AND messageId = $messageId
    `;

    const res = await this.query(statement, {
      $messageId: messageId,
      $now: Date.now()
    });

    return res.status === 'success';
  }

  /**
   * Deep historical pagination query using Couchbase SQL++
   */
  static async getHistory(chatId: string, beforeTimestamp: number, limit = 30): Promise<any[]> {
    const cfg = this.getEndpoint();
    if (!cfg) return [];

    const statement = `
      SELECT m.* FROM \`${cfg.bucket}\`.\`${cfg.scope}\`.\`${cfg.collection}\` m
      WHERE m.type = 'message' AND m.chatId = $chatId AND m.timestamp < $beforeTimestamp
      ORDER BY m.timestamp DESC
      LIMIT $limit
    `;

    const res = await this.query(statement, {
      $chatId: chatId,
      $beforeTimestamp: beforeTimestamp,
      $limit: limit
    });

    if (res.status === 'success' && res.results) {
      return res.results;
    }
    return [];
  }
}
