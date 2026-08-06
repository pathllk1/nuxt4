import { defineEventHandler, getHeader, getCookie, getRequestIP, setResponseHeader, sendError, createError } from 'h3';
import User from '../models/User';
import Session from '../models/Session';
import { connectDB } from '../plugins/mongodb';
import { 
  verifyAccessToken, 
  verifyRefreshToken, 
  generateAccessToken,
  generateRefreshToken,
  getTokenExpiration
} from '../utils/jwt';
import { 
  generateDeviceFingerprint, 
  parseDeviceInfo,
  getLocationFromIP,
  logSecurityEvent, 
  isTokenBlacklisted,
  blacklistToken,
  validateSession 
} from '../utils/security';

export default defineEventHandler(async (event) => {
  const path = event.path;

  // Only intercept protected API routes
  const isProtectedApiRoute = path.startsWith('/api/') && 
                              !path.startsWith('/api/auth/login') && 
                              !path.startsWith('/api/auth/signup') && 
                              !path.startsWith('/api/auth/refresh') && 
                              !path.startsWith('/api/_nuxt_icon/') && 
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
    
    // Validate device fingerprint if present in token
    if (decoded.deviceFingerprint) {
      const currentFingerprint = generateDeviceFingerprint(event);
      if (decoded.deviceFingerprint !== currentFingerprint) {
        await logSecurityEvent({
          userId: decoded.id,
          email: decoded.email,
          action: 'anomaly_detected',
          event,
          metadata: { 
            reason: 'Device fingerprint mismatch in access token',
            expected: decoded.deviceFingerprint,
            received: currentFingerprint
          },
          severity: 'critical'
        });
        
        throw createError({
          statusCode: 401,
          statusMessage: 'Unauthorized: Device fingerprint mismatch'
        });
      }
    }
    
    // Check if user account is locked
    const user = await (User as any).findById(decoded.id);
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

    if (user.isAccountLocked) {
      const lockedUntil = user.securitySettings?.accountLockedUntil;
      if (lockedUntil && new Date(lockedUntil) > new Date()) {
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
          data: { lockedUntil: lockedUntil.toISOString() }
        });
      } else {
        // Lock expired, unlock account
        user.isAccountLocked = false;
        if (user.securitySettings) {
          user.securitySettings.accountLockedUntil = undefined;
        }
        await user.save();
      }
    }
    
    // Attach user payload to Nitro context
    event.context.user = decoded;
  } catch (error: any) {
    // If token is expired, attempt silent refresh if refresh token is provided in headers
    if (error.message === 'TOKEN_EXPIRED') {
      const refreshTokenValue = getHeader(event, 'x-refresh-token');
      
      if (refreshTokenValue) {
        try {
          if (await isTokenBlacklisted(refreshTokenValue)) {
            await logSecurityEvent({
              action: 'invalid_token',
              event,
              metadata: { reason: 'Refresh token is blacklisted' },
              severity: 'high'
            });
            
            throw createError({
              statusCode: 401,
              statusMessage: 'Unauthorized: Refresh token has been revoked'
            });
          }
          
          const decodedRefresh = verifyRefreshToken(refreshTokenValue);
          
          // Validate session
          const sessionValidation = await validateSession(refreshTokenValue, event);
          if (!sessionValidation.valid) {
            await logSecurityEvent({
              userId: decodedRefresh.id,
              action: 'invalid_token',
              event,
              metadata: { reason: sessionValidation.reason },
              severity: 'high'
            });
            
            throw createError({
              statusCode: 401,
              statusMessage: `Unauthorized: ${sessionValidation.reason}`
            });
          }
          
          const session = await Session.findOne({ 
            refreshToken: refreshTokenValue, 
            userId: decodedRefresh.id,
            isActive: true 
          } as any);

          if (session) {
            const user = await (User as any).findById(decodedRefresh.id);
            if (user) {
              // RT-B2: Enforce status and account lock checks during silent refresh
              if (user.role !== 'superadmin') {
                if (user.status === 'pending') {
                  throw createError({
                    statusCode: 403,
                    statusMessage: 'Your account is pending administrator approval before you can log in.'
                  });
                }
                if (user.status === 'suspended') {
                  const oldExp = getTokenExpiration(refreshTokenValue) || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                  await blacklistToken(refreshTokenValue, 'refresh', user._id.toString(), 'User suspended', oldExp);
                  throw createError({
                    statusCode: 403,
                    statusMessage: 'Your account has been suspended by an administrator.'
                  });
                }
              }

              if (user.isAccountLocked) {
                const lockedUntil = user.securitySettings?.accountLockedUntil;
                if (lockedUntil && new Date(lockedUntil) > new Date()) {
                  throw createError({
                    statusCode: 403,
                    statusMessage: 'Account locked due to suspicious activity'
                  });
                }
              }

              const deviceFingerprint = generateDeviceFingerprint(event);
              const newAccessToken = generateAccessToken(user, deviceFingerprint);

              // RT-B1: Support token rotation in silent refresh when enabled
              let newRefreshToken = refreshTokenValue;
              const shouldRotate = process.env.ROTATE_REFRESH_TOKEN === 'true';
              if (shouldRotate) {
                newRefreshToken = generateRefreshToken(user, deviceFingerprint);
                const oldExp = getTokenExpiration(refreshTokenValue) || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                await blacklistToken(refreshTokenValue, 'refresh', user._id.toString(), 'Token rotated (silent)', oldExp);
                session.refreshToken = newRefreshToken;
                session.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
              }

              // RT-B3: Update session metadata (IP, user agent, device info, location, last activity)
              const clientIP = getRequestIP(event, { xForwardedFor: true }) || 'unknown';
              const userAgent = getHeader(event, 'user-agent') || 'unknown';
              session.ipAddress = clientIP;
              session.userAgent = userAgent;
              session.deviceInfo = parseDeviceInfo(userAgent);
              session.location = getLocationFromIP(clientIP);
              session.lastActivity = new Date();
              await session.save();

              // Log token refresh
              await logSecurityEvent({
                userId: user._id.toString(),
                email: user.email,
                action: 'token_refresh',
                event,
                severity: 'low'
              });
              
              // RT-B5 & Auto-Refresh: Expose headers via CORS so client script can read new tokens
              setResponseHeader(event, 'x-new-access-token', newAccessToken);
              if (shouldRotate) {
                setResponseHeader(event, 'x-new-refresh-token', newRefreshToken);
                setResponseHeader(event, 'Access-Control-Expose-Headers', 'x-new-access-token, x-new-refresh-token');
              } else {
                setResponseHeader(event, 'Access-Control-Expose-Headers', 'x-new-access-token');
              }
              
              // Proceed with the request using the new token's payload
              const newDecoded = verifyAccessToken(newAccessToken);
              event.context.user = newDecoded;
              return;
            }
          }
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
