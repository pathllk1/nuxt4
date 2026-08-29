/**
 * Redis Hot-Context Chat Cache Manager
 * Provides sub-millisecond memory for active LLM conversations with Mongo fallback
 */

export interface CachedChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  provider?: string;
  model?: string;
  tokens_used?: number;
  created_at?: string;
}

const CHAT_CACHE_PREFIX = 'ai:chat:';
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days rolling TTL

/**
 * Retrieve hot chat message history from Redis
 */
export async function getCachedChatMessages(conversationId: string): Promise<CachedChatMessage[] | null> {
  try {
    const storage = useStorage('cache');
    const key = `${CHAT_CACHE_PREFIX}conv:${conversationId}:messages`;
    const cached = await storage.getItem<CachedChatMessage[]>(key);
    if (Array.isArray(cached) && cached.length > 0) {
      return cached;
    }
    return null;
  } catch (error) {
    console.warn(`[ChatCache] Error reading cache for ${conversationId}:`, error);
    return null;
  }
}

/**
 * Cache full chat message history in Redis with rolling TTL
 */
export async function setCachedChatMessages(
  conversationId: string,
  messages: CachedChatMessage[],
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<void> {
  try {
    const storage = useStorage('cache');
    const key = `${CHAT_CACHE_PREFIX}conv:${conversationId}:messages`;
    await storage.setItem(key, messages, { ttl: ttlSeconds });
  } catch (error) {
    console.warn(`[ChatCache] Error setting cache for ${conversationId}:`, error);
  }
}

/**
 * Append a single turn (user or assistant) to Redis hot cache
 */
export async function appendCachedChatMessage(
  conversationId: string,
  message: CachedChatMessage,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<void> {
  try {
    const storage = useStorage('cache');
    const key = `${CHAT_CACHE_PREFIX}conv:${conversationId}:messages`;
    const existing = (await storage.getItem<CachedChatMessage[]>(key)) || [];
    
    // Check if already in list to avoid duplicates
    const exists = existing.some(m => m.id === message.id || (m.role === message.role && m.content === message.content && m.created_at === message.created_at));
    if (!exists) {
      existing.push(message);
      // Keep last 100 turns in hot memory
      const trimmed = existing.slice(-100);
      await storage.setItem(key, trimmed, { ttl: ttlSeconds });
    }
  } catch (error) {
    console.warn(`[ChatCache] Error appending to cache for ${conversationId}:`, error);
  }
}

/**
 * Invalidate Redis cache for a conversation (e.g. on delete or clear)
 */
export async function invalidateConversationCache(conversationId: string): Promise<void> {
  try {
    const storage = useStorage('cache');
    const key = `${CHAT_CACHE_PREFIX}conv:${conversationId}:messages`;
    await storage.removeItem(key);
  } catch (error) {
    console.warn(`[ChatCache] Error invalidating cache for ${conversationId}:`, error);
  }
}

/**
 * Invalidate multiple conversation caches (e.g. on clear all)
 */
export async function invalidateManyConversationsCache(conversationIds: string[]): Promise<void> {
  try {
    const storage = useStorage('cache');
    for (const id of conversationIds) {
      await storage.removeItem(`${CHAT_CACHE_PREFIX}conv:${id}:messages`);
    }
  } catch (error) {
    console.warn('[ChatCache] Error invalidating multiple caches:', error);
  }
}
