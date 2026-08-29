import { defineEventHandler, getQuery, readBody, setHeader, getRequestIP, createError } from 'h3';
import { sanitizeQueryParams, sanitizeObject } from '../utils/sanitizer';
import { useRedis } from '../utils/redis';

// Bounded LRU in-memory rate-limit store for fallback
interface RateLimitBucket {
  timestamps: number[];
  banUntil?: number;
}
const MAX_STORE_ENTRIES = 10000;
const rateLimitStore = new Map<string, RateLimitBucket>();

const evictOldEntries = () => {
  if (rateLimitStore.size > MAX_STORE_ENTRIES) {
    const toDelete = rateLimitStore.size - MAX_STORE_ENTRIES;
    const iterator = rateLimitStore.keys();
    for (let i = 0; i < toDelete; i++) {
      const key = iterator.next().value;
      if (key) rateLimitStore.delete(key);
    }
  }
};

const checkRateLimitMemory = (
  ip: string,
  route: string,
  max: number,
  timeWindowMs: number,
  banThreshold: number = 0,
  banDurationMs: number = 0
): { allowed: boolean; retryAfter: number } => {
  const now = Date.now();
  const key = `${ip}:${route}`;
  
  let bucket = rateLimitStore.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    rateLimitStore.set(key, bucket);
    evictOldEntries();
  }

  // Check if banned
  if (bucket.banUntil && bucket.banUntil > now) {
    return { allowed: false, retryAfter: Math.ceil((bucket.banUntil - now) / 1000) };
  }

  // Clean expired timestamps
  bucket.timestamps = bucket.timestamps.filter(ts => now - ts < timeWindowMs);

  if (bucket.timestamps.length >= max) {
    let retryAfter = 0;
    if (bucket.timestamps.length > 0) {
      const oldestTs = bucket.timestamps[0];
      if (oldestTs !== undefined) {
        retryAfter = Math.ceil((oldestTs + timeWindowMs - now) / 1000);
      }
    }
    
    // Apply temporary ban if threshold exceeded
    if (banThreshold > 0 && bucket.timestamps.length >= banThreshold && banDurationMs > 0) {
      bucket.banUntil = now + banDurationMs;
      retryAfter = Math.ceil(banDurationMs / 1000);
    }

    return { allowed: false, retryAfter: Math.max(1, retryAfter) };
  }

  // Record request
  bucket.timestamps.push(now);
  return { allowed: true, retryAfter: 0 };
};

const checkRateLimit = async (
  ip: string,
  route: string,
  max: number,
  timeWindowMs: number,
  banThreshold: number = 0,
  banDurationMs: number = 0
): Promise<{ allowed: boolean; retryAfter: number }> => {
  const redis = useRedis();
  if (redis) {
    try {
      const windowSec = Math.ceil(timeWindowMs / 1000);
      const key = `ratelimit:${route}:${ip}`;
      const banKey = `ratelimit:ban:${route}:${ip}`;

      // Check if banned
      const bannedTtl = await redis.ttl(banKey);
      if (bannedTtl > 0) {
        return { allowed: false, retryAfter: bannedTtl };
      }

      // Atomic increment in Redis
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, windowSec);
      }

      if (current > max) {
        const ttl = await redis.ttl(key);
        // Apply ban if threshold exceeded
        if (banThreshold > 0 && current >= banThreshold && banDurationMs > 0) {
          const banSec = Math.ceil(banDurationMs / 1000);
          await redis.set(banKey, '1', { ex: banSec });
          return { allowed: false, retryAfter: banSec };
        }
        return { allowed: false, retryAfter: Math.max(1, ttl) };
      }

      return { allowed: true, retryAfter: 0 };
    } catch (err) {
      console.warn('[Security] Redis rate limit check failed, using memory fallback:', err);
    }
  }

  // Fallback to in-memory store
  return checkRateLimitMemory(ip, route, max, timeWindowMs, banThreshold, banDurationMs);
};

export default defineEventHandler(async (event) => {
  const path = event.path;

  // 1. Security Headers
  setHeader(event, 'X-Content-Type-Options', 'nosniff');
  setHeader(event, 'X-Frame-Options', 'DENY');
  setHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin');
  setHeader(event, 'Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  setHeader(event, 'Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

  // Content-Security-Policy (allows HTTPS images and Google/Firebase Auth scripts & iframes)
  setHeader(event, 'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://*.firebaseapp.com https://*.googleapis.com https://accounts.google.com; " +
    "style-src 'self' 'unsafe-inline' https:; " +
    "font-src 'self' data: https:; " +
    "img-src 'self' data: blob: https: http: https://*.googleusercontent.com; " +
    "connect-src 'self' https: ws: wss: https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.firebaseio.com https://*.googleapis.com; " +
    "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://*.google.com; " +
    "frame-ancestors 'none';"
  );
  setHeader(event, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // Fix #16: Removed deprecated X-XSS-Protection header (CSP replaces it)

  // 2. Rate Limiting for Auth API paths
  if (path.startsWith('/api/auth/')) {
    const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown';

    // Fix #11: Rate limit ALL IPs equally — no localhost exemption
    let limitCheck = { allowed: true, retryAfter: 0 };

    if (path.includes('/login')) {
      // Login limit: 10 attempts per 15 minutes, ban after 20 failed logins
      limitCheck = await checkRateLimit(ip, 'login', 10, 15 * 60 * 1000, 20, 15 * 60 * 1000);
    } else if (path.includes('/signup')) {
      // Signup limit: 5 attempts per hour
      limitCheck = await checkRateLimit(ip, 'signup', 5, 60 * 60 * 1000);
    } else if (path.includes('/refresh')) {
      // Refresh limit: 300 per 15 minutes to support multi-tab apps & silent auto-refreshes
      limitCheck = await checkRateLimit(ip, 'refresh', 300, 15 * 60 * 1000);
    }

    if (!limitCheck.allowed) {
      setHeader(event, 'Retry-After', String(limitCheck.retryAfter) as any);
      throw createError({
        statusCode: 429,
        statusMessage: 'Too Many Requests',
        data: {
          retryAfter: limitCheck.retryAfter,
          message: `Too many requests. Please try again after ${limitCheck.retryAfter} seconds.`
        }
      });
    }
  }

  // 3. XSS Sanitization for Request Body & Query Parameters
  // Sanitize query params
  const query = getQuery(event);
  if (query && Object.keys(query).length > 0) {
    sanitizeQueryParams(query);
  }

  // Sanitize request body (if POST, PUT, PATCH method and not file upload)
  const method = event.method;
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    const contentType = event.node.req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      try {
        const body = await readBody(event);
        if (body && typeof body === 'object') {
          sanitizeObject(body);
        }
      } catch (e) {
        // Ignored if body is empty or not parsable JSON
      }
    }
  }
});
