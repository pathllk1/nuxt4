import { defineEventHandler, getHeader, setResponseHeader, sendError, createError } from 'h3';
import User from '../models/User';
import Session from '../models/Session';
import { 
  verifyAccessToken, 
  verifyRefreshToken, 
  generateAccessToken 
} from '../utils/jwt';
import { 
  generateDeviceFingerprint, 
  logSecurityEvent, 
  isTokenBlacklisted,
  validateSession 
} from '../utils/security';

export default defineEventHandler(async (event) => {
  const path = event.path;

  // Only intercept protected API routes
  const isProtectedApiRoute = path.startsWith('/api/') && 
                              !path.startsWith('/api/auth/login') && 
                              !path.startsWith('/api/auth/signup') && 
                              !path.startsWith('/api/auth/refresh') && 
                              path !== '/api/health' && 
                              path !== '/api/info';

  if (!isProtectedApiRoute) {
    return;
  }

  const authHeader = getHeader(event, 'authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    await logSecurityEvent({
      action: 'invalid_token',
      event,
      metadata: { reason: 'No authorization header' },
      severity: 'low'
    });
    
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: No token provided'
    });
  }

  const token = authHeader.split(' ')[1];
  
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
      const lockedUntil = user.securitySettings.accountLockedUntil;
      if (lockedUntil && lockedUntil > new Date()) {
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
        user.securitySettings.accountLockedUntil = undefined;
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
              const deviceFingerprint = generateDeviceFingerprint(event);
              const newAccessToken = generateAccessToken(user, deviceFingerprint);
              
              // Log token refresh
              await logSecurityEvent({
                userId: user._id.toString(),
                email: user.email,
                action: 'token_refresh',
                event,
                severity: 'low'
              });
              
              // Return new token in header
              setResponseHeader(event, 'x-new-access-token', newAccessToken);
              
              // Proceed with the request using the new token's payload
              const newDecoded = verifyAccessToken(newAccessToken);
              event.context.user = newDecoded;
              return;
            }
          }
        } catch (refreshError) {
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
