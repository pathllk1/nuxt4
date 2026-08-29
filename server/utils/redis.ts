import { Redis } from '@upstash/redis';
import crypto from 'crypto';

let redisClientInstance: Redis | null = null;

/**
 * Get the singleton Upstash Redis client instance.
 * Returns null if Upstash credentials are not configured in environment.
 */
export function useRedis(): Redis | null {
  if (redisClientInstance) {
    return redisClientInstance;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  redisClientInstance = new Redis({
    url,
    token
  });

  return redisClientInstance;
}

/**
 * Acquire a distributed lock using Upstash Redis.
 * Returns a unique lockId string on success, or null if lock is held or Redis unavailable.
 */
export async function acquireRedisLock(lockKey: string, ttlMs: number = 5000): Promise<string | null> {
  const redis = useRedis();
  if (!redis) return null;

  const lockId = crypto.randomUUID();
  try {
    const result = await redis.set(lockKey, lockId, { nx: true, px: ttlMs });
    if (result === 'OK') {
      return lockId;
    }
    return null;
  } catch (error) {
    console.warn('[Redis] Failed to acquire lock:', error);
    return null;
  }
}

/**
 * Release a distributed lock safely using lockId.
 */
export async function releaseRedisLock(lockKey: string, lockId: string): Promise<boolean> {
  const redis = useRedis();
  if (!redis) return false;

  try {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const res = await redis.eval(script, [lockKey], [lockId]);
    return res === 1;
  } catch (error) {
    // Fallback if eval fails: check and del
    try {
      const current = await redis.get<string>(lockKey);
      if (current === lockId) {
        await redis.del(lockKey);
        return true;
      }
    } catch {
      // Ignored
    }
    return false;
  }
}

/**
 * Cache rotated token mapping (oldTokenHash -> newRawToken) for grace period bridging.
 */
export async function cacheRotatedToken(oldTokenHash: string, newRawToken: string, ttlSec: number = 60): Promise<void> {
  const redis = useRedis();
  if (!redis) return;

  try {
    await redis.set(`auth:rotated:${oldTokenHash}`, newRawToken, { ex: ttlSec });
  } catch (error) {
    console.warn('[Redis] Failed to cache rotated token:', error);
  }
}

/**
 * Retrieve cached rotated token mapping if rotated recently.
 */
export async function getRotatedToken(oldTokenHash: string): Promise<string | null> {
  const redis = useRedis();
  if (!redis) return null;

  try {
    return await redis.get<string>(`auth:rotated:${oldTokenHash}`);
  } catch (error) {
    console.warn('[Redis] Failed to get rotated token from cache:', error);
    return null;
  }
}
