import { defineEventHandler, readBody, createError, getRequestIP, getHeader } from 'h3';
import User from '../../models/User';
import Session from '../../models/Session';
import { 
  verifyRefreshToken, 
  generateAccessToken, 
  generateRefreshToken,
  getTokenExpiration 
} from '../../utils/jwt';
import { 
  isTokenBlacklisted, 
  validateSession, 
  logSecurityEvent,
  blacklistToken,
  generateDeviceFingerprint,
  parseDeviceInfo,
  getLocationFromIP
} from '../../utils/security';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { refreshToken } = body || {};

  if (!refreshToken) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Refresh token required'
    });
  }

  try {
    // 1. Blacklist check
    if (await isTokenBlacklisted(refreshToken)) {
      await logSecurityEvent({
        action: 'invalid_token',
        event,
        metadata: { reason: 'Refresh token is blacklisted' },
        severity: 'high'
      });
      
      throw createError({
        statusCode: 401,
        statusMessage: 'Refresh token has been revoked'
      });
    }

    // 2. Verify token signature and claims
    const decoded = verifyRefreshToken(refreshToken);

    // 3. Validate Session
    const sessionValidation = await validateSession(refreshToken, event);
    if (!sessionValidation.valid) {
      await logSecurityEvent({
        userId: decoded.id,
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
      refreshToken,
      userId: decoded.id,
      isActive: true
    } as any);

    if (!session) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: Session not found'
      });
    }

    // 4. Fetch User
    const user = await (User as any).findById(decoded.id);
    if (!user || user.status === 'suspended' || user.status === 'pending') {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: User not found, pending, or suspended'
      });
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

    // 5. Generate new access token
    const deviceFingerprint = generateDeviceFingerprint(event);
    const newAccessToken = generateAccessToken(user, deviceFingerprint);
    let newRefreshToken = refreshToken;

    // Token rotation matches ROTATE_REFRESH_TOKEN in .env
    const shouldRotate = process.env.ROTATE_REFRESH_TOKEN === 'true';
    if (shouldRotate) {
      newRefreshToken = generateRefreshToken(user, deviceFingerprint);
      
      // Blacklist old refresh token
      const oldExp = getTokenExpiration(refreshToken) || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await blacklistToken(refreshToken, 'refresh', user._id.toString(), 'Token rotated', oldExp);
      
      // Update session with new refresh token
      session.refreshToken = newRefreshToken;
      session.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    // Update session active states
    const clientIP = getRequestIP(event, { xForwardedFor: true }) || 'unknown';
    const userAgent = getHeader(event, 'user-agent') || 'unknown';
    
    session.ipAddress = clientIP;
    session.userAgent = userAgent;
    session.deviceInfo = parseDeviceInfo(userAgent);
    session.location = getLocationFromIP(clientIP);
    session.lastActivity = new Date();
    await session.save();

    // Log refresh event
    await logSecurityEvent({
      userId: user._id.toString(),
      email: user.email,
      action: 'token_refresh',
      event,
      severity: 'low'
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    };
  } catch (error: any) {
    if (error.statusCode) {
      throw error;
    }
    
    console.error('Refresh token API error:', error);
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: Refresh process failed'
    });
  }
});
