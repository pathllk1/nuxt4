import { defineEventHandler, getQuery, readBody, setHeader, getRequestIP, createError } from 'h3';
import { sanitizeQueryParams, sanitizeObject } from '../utils/sanitizer';

// Fix #10: Bounded LRU rate-limit store (prevents unbounded memory growth)
// NOTE: For multi-instance/serverless deployments, migrate to Redis/Upstash
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

const checkRateLimit = (
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

export default defineEventHandler(async (event) => {
  const path = event.path;

  // 1. Security Headers
  setHeader(event, 'X-Content-Type-Options', 'nosniff');
  setHeader(event, 'X-Frame-Options', 'DENY');
  setHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin');
  setHeader(event, 'Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // Content-Security-Policy (allows HTTPS images like freepik, randomuser, unsplash, etc.)
  setHeader(event, 'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline' https:; " +
    "font-src 'self' data: https:; " +
    "img-src 'self' data: blob: https: http:; " +
    "connect-src 'self' https: ws: wss:; " +
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
      limitCheck = checkRateLimit(ip, 'login', 10, 15 * 60 * 1000, 20, 15 * 60 * 1000);
    } else if (path.includes('/signup')) {
      // Signup limit: 5 attempts per hour
      limitCheck = checkRateLimit(ip, 'signup', 5, 60 * 60 * 1000);
    } else if (path.includes('/refresh')) {
      // Refresh limit: 300 per 15 minutes to support multi-tab apps & silent auto-refreshes
      limitCheck = checkRateLimit(ip, 'refresh', 300, 15 * 60 * 1000);
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
