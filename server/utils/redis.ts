import { Redis } from '@upstash/redis';

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
