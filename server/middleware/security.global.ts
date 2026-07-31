import { defineEventHandler, getQuery, readBody, setHeader, getRequestIP } from 'h3';

// Simple in-memory rate limiter store
interface RateLimitBucket {
  timestamps: number[];
  banUntil?: number;
}
const rateLimitStore = new Map<string, RateLimitBucket>();

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
      retryAfter = Math.ceil((oldestTs + timeWindowMs - now) / 1000);
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

  // 1. Add Security Headers for all responses
  setHeader(event, 'X-Content-Type-Options', 'nosniff');
  setHeader(event, 'X-Frame-Options', 'DENY');
  setHeader(event, 'X-XSS-Protection', '1; mode=block');
  setHeader(event, 'Referrer-Policy', 'strict-origin');
  setHeader(event, 'Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // 2. Perform Rate Limiting for Auth API paths
  if (path.startsWith('/api/auth/')) {
    const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown';

    // Exempt localhost from rate limits to match fastify1 configurations
    if (ip !== '127.0.0.1' && ip !== 'localhost' && ip !== '::1') {
      let limitCheck = { allowed: true, retryAfter: 0 };

      if (path.includes('/login')) {
        // Login limit: 5 attempts per 15 minutes, ban after 15 failed logins
        limitCheck = checkRateLimit(ip, 'login', 5, 15 * 60 * 1000, 15, 15 * 60 * 1000);
      } else if (path.includes('/signup')) {
        // Signup limit: 3 attempts per hour
        limitCheck = checkRateLimit(ip, 'signup', 3, 60 * 60 * 1000);
      } else if (path.includes('/refresh')) {
        // Refresh limit: 20 per 15 minutes
        limitCheck = checkRateLimit(ip, 'refresh', 20, 15 * 60 * 1000);
      }

      if (!limitCheck.allowed) {
        setHeader(event, 'Retry-After', String(limitCheck.retryAfter));
        event.node.res.statusCode = 429;
        return {
          success: false,
          statusCode: 429,
          error: 'Too Many Requests',
          message: `Too many requests. Please try again after ${limitCheck.retryAfter} seconds.`,
          retryAfter: limitCheck.retryAfter
        };
      }
    }
  }

  // 3. XSS Sanitization for Request Body & Query Parameters
  // Sanitize query params
  const query = getQuery(event);
  if (query && Object.keys(query).length > 0) {
    sanitizeQueryParams(query);
  }

  // Sanitize request body (if POST, PUT, PATCH method)
  const method = event.method;
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    try {
      const body = await readBody(event);
      if (body && typeof body === 'object') {
        sanitizeObject(body);
      }
    } catch (e) {
      // Ignored if body is empty or not parsable JSON
    }
  }
});
