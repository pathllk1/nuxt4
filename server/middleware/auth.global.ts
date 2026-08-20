import { defineEventHandler, getHeader, getCookie, getRequestIP, setResponseHeader, setCookie, sendError, createError } from 'h3';
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
  } catch (error: any) {
    // If token is expired, attempt silent refresh if refresh token is provided in headers or cookies
    if (error.message === 'TOKEN_EXPIRED') {
      const refreshTokenValue = getHeader(event, 'x-refresh-token') || getCookie(event, 'refresh_token');
      
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
              const user = await User.findById(decodedRefresh.id);
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

                const isLocked = await user.checkAndUnlockAccount();
                if (isLocked) {
                  throw createError({
                    statusCode: 403,
                    statusMessage: 'Account locked due to suspicious activity'
                  });
                }

                const deviceFingerprint = generateDeviceFingerprint(event);
                const reqFirmId = getHeader(event, 'x-firm-id') || getHeader(event, 'X-Firm-ID');
                const targetFirmId = reqFirmId || (user.firms && user.firms.length > 0 ? ((user.firms[0]?.firm as any)?._id?.toString() || user.firms[0]?.firm?.toString()) : undefined);
                const targetMembership = (user.firms || []).find((f: any) => ((f.firm as any)?._id?.toString() || f.firm?.toString()) === targetFirmId);
                const targetGrade = targetMembership?.grade;

                const newAccessToken = generateAccessToken(user, deviceFingerprint, targetFirmId, targetGrade);

              // RT-B1: Support token rotation in silent refresh when enabled
              let newRefreshToken = refreshTokenValue;
              const shouldRotate = process.env.ROTATE_REFRESH_TOKEN === 'true';
              if (shouldRotate) {
                newRefreshToken = generateRefreshToken(user, deviceFingerprint);
                session.previousRefreshToken = refreshTokenValue;
                session.previousRotatedAt = new Date();
                session.refreshToken = newRefreshToken;
                session.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
              } else {
                session.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
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
              
              const isProduction = process.env.NODE_ENV === 'production';
              setCookie(event, 'access_token', newAccessToken, {
                httpOnly: true,
                secure: isProduction,
                sameSite: 'strict', // Strict for CSRF protection
                path: '/',
                maxAge: 15 * 60
              });
              if (shouldRotate) {
                setCookie(event, 'refresh_token', newRefreshToken, {
                  httpOnly: true,
                  secure: isProduction,
                  sameSite: 'strict', // Strict for CSRF protection
                  path: '/',
                  maxAge: 60 * 60 * 24 * 30
                });
              }

              // RT-B5 & Auto-Refresh: Expose access token header for client-side detection
              // Refresh token is NEVER exposed - it's already set in HttpOnly cookie
              setResponseHeader(event, 'x-new-access-token', newAccessToken);
              setResponseHeader(event, 'Access-Control-Expose-Headers', 'x-new-access-token');
              
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
