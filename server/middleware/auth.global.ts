import { defineEventHandler, getHeader, getCookie, getRequestIP, setResponseHeader, setCookie, createError } from 'h3';
import User from '../models/User';
import { connectDB } from '../plugins/mongodb';
import { 
  verifyAccessToken, 
} from '../utils/jwt';
import { 
  generateDeviceFingerprint, 
  logSecurityEvent, 
  isTokenBlacklisted,
} from '../utils/security';
import { performTokenRefresh } from '../services/authService';

export default defineEventHandler(async (event) => {
  const path = event.path;

  // Only intercept protected API routes
  // BUG-11 FIX: Added /api/auth/logout to exempt list so logout always succeeds
  const isProtectedApiRoute = path.startsWith('/api/') && 
                              !path.startsWith('/api/auth/login') && 
                              !path.startsWith('/api/auth/signup') && 
                              !path.startsWith('/api/auth/refresh') && 
                              !path.startsWith('/api/auth/logout') &&
                              !path.startsWith('/api/_nuxt_icon/') && 
                              !(path === '/api/firms' && event.method === 'GET') &&
                              path !== '/api/health' && 
                              path !== '/api/info';

  if (!isProtectedApiRoute) {
    return;
  }

  // Ensure DB connection is established before querying models
  await connectDB();

  const authHeader = getHeader(event, 'authorization');
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : getCookie(event, 'access_token');

  if (!token) {
    // No access token — attempt refresh using centralized service
    const refreshTokenValue = getHeader(event, 'x-refresh-token') || getCookie(event, 'refresh_token');
    
    if (refreshTokenValue) {
      try {
        const result = await performTokenRefresh(refreshTokenValue, event);
        
        // Set new cookies
        const isProduction = process.env.NODE_ENV === 'production';
        setCookie(event, 'access_token', result.accessToken, {
          httpOnly: true,
          secure: isProduction,
          sameSite: 'strict',
          path: '/',
          maxAge: 15 * 60
        });

        // Always re-set refresh_token cookie to resynchronize browser
        // (critical for self-heal recovery after idle wakeup with rotation enabled)
        setCookie(event, 'refresh_token', result.refreshToken, {
          httpOnly: true,
          secure: isProduction,
          sameSite: 'strict',
          path: '/',
          maxAge: 60 * 60 * 24 * 30
        });

        // SEC-10: Attach user document to event context for downstream reuse
        event.context.user = result.decoded;
        event.context.userDoc = result.user;
        
        console.log('[Middleware] Auto-refresh successful (no access token)');
        return;
      } catch (refreshError: any) {
        console.error('[Middleware] Auto-refresh failed when no access token:', refreshError.message);
        throw createError({
          statusCode: refreshError.statusCode || 401,
          statusMessage: refreshError.statusMessage || 'Unauthorized: Token refresh failed'
        });
      }
    }
    
    // No token and no refresh token available
    await logSecurityEvent({
      action: 'invalid_token',
      event,
      metadata: { reason: 'No authorization header or cookie provided' },
      severity: 'low'
    });
    
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: No token provided'
    });
  }
  
  // Check if token is blacklisted
  if (await isTokenBlacklisted(token as any)) {
    await logSecurityEvent({
      action: 'invalid_token',
      event,
      metadata: { reason: 'Token is blacklisted' },
      severity: 'high'
    });
    
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: Token has been revoked'
    });
  }
  
  try {
    const decoded = verifyAccessToken(token as any);
    
    // Validate device fingerprint if present in token (soft enforcement - log warning only)
    if (decoded.deviceFingerprint) {
      const currentFingerprint = generateDeviceFingerprint(event);
      if (decoded.deviceFingerprint !== currentFingerprint) {
        await logSecurityEvent({
          userId: decoded.id,
          email: decoded.email,
          action: 'anomaly_detected',
          event,
          metadata: { 
            reason: 'Device fingerprint mismatch in access token (weak signal - warning only)',
            expected: decoded.deviceFingerprint,
            received: currentFingerprint
          },
          severity: 'medium'
        });
      }
    }
    
    // Check if user account is locked
    const user = await User.findById(decoded.id);
    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: User not found'
      });
    }
    
    if (user.role !== 'superadmin') {
      if (user.status === 'pending') {
        throw createError({
          statusCode: 403,
          statusMessage: 'Your account is pending administrator approval before you can log in.'
        });
      }
      if (user.status === 'suspended') {
        throw createError({
          statusCode: 403,
          statusMessage: 'Your account has been suspended by an administrator.'
        });
      }
    }

    const isLocked = await user.checkAndUnlockAccount();
    if (isLocked) {
      await logSecurityEvent({
        userId: user._id.toString(),
        email: user.email,
        action: 'suspicious_activity',
        event,
        metadata: { reason: 'Attempted access with locked account' },
        severity: 'high'
      });
      
      throw createError({
        statusCode: 403,
        statusMessage: 'Account locked due to suspicious activity',
        data: { lockedUntil: user.securitySettings?.accountLockedUntil?.toISOString() }
      });
    }
    
    // Attach user payload to Nitro context
    event.context.user = decoded;
    // SEC-10: Attach full user doc so requireAuthSession can reuse it
    event.context.userDoc = user;
  } catch (error: any) {
    // If token is expired, attempt refresh using centralized service
    if (error.message === 'TOKEN_EXPIRED') {
      const refreshTokenValue = getHeader(event, 'x-refresh-token') || getCookie(event, 'refresh_token');
      
      if (refreshTokenValue) {
        try {
          const result = await performTokenRefresh(refreshTokenValue, event);

          const isProduction = process.env.NODE_ENV === 'production';
          setCookie(event, 'access_token', result.accessToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'strict',
            path: '/',
            maxAge: 15 * 60
          });

          // Always re-set refresh_token cookie to resynchronize browser
          // (critical for self-heal recovery after idle wakeup with rotation enabled)
          setCookie(event, 'refresh_token', result.refreshToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'strict',
            path: '/',
            maxAge: 60 * 60 * 24 * 30
          });

          // Expose access token header for client-side detection
          setResponseHeader(event, 'x-new-access-token', result.accessToken);
          setResponseHeader(event, 'Access-Control-Expose-Headers', 'x-new-access-token');
          
          // SEC-10: Attach user context for downstream reuse
          event.context.user = result.decoded;
          event.context.userDoc = result.user;
          return;
        } catch (refreshError: any) {
          if (refreshError.statusCode) {
            throw refreshError;
          }
          await logSecurityEvent({
            action: 'invalid_token',
            event,
            metadata: { reason: 'Refresh token validation failed', error: String(refreshError) },
            severity: 'medium'
          });
        }
      }
    }
    
    await logSecurityEvent({
      action: 'invalid_token',
      event,
      metadata: { reason: error.message || 'Token verification failed' },
      severity: 'medium'
    });
    
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: Invalid or expired token'
    });
  }
});
