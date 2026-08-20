import { defineEventHandler, readBody, createError, getRequestIP, getHeader, getCookie, setCookie } from 'h3';
import User from '../../models/User';
import Session from '../../models/Session';
import { connectDB } from '../../plugins/mongodb';
import { 
  verifyRefreshToken, 
  generateAccessToken, 
  generateRefreshToken,
  getTokenExpiration 
} from '../../utils/jwt';
import { 
  isTokenBlacklisted, 
  logSecurityEvent,
  generateDeviceFingerprint,
  parseDeviceInfo,
  getLocationFromIP
} from '../../utils/security';

const REFRESH_GRACE_PERIOD_MS = 30 * 1000; // 30 seconds concurrency grace window
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export default defineEventHandler(async (event) => {
  await connectDB();
  const body = await readBody(event).catch(() => ({}));
  // Prioritize secure HttpOnly cookie from browser over potentially stale JavaScript in-memory body
  const refreshToken = getCookie(event, 'refresh_token') || (body && body.refreshToken);

  if (!refreshToken) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Refresh token required'
    });
  }

  try {
    // 1. Verify token signature and claims
    let decoded: any;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (jwtErr: any) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid or expired refresh token'
      });
    }

    // 2. Find active session (check primary refreshToken or recent previousRefreshToken in grace window)
    const session = await Session.findOne({
      userId: decoded.id,
      isActive: true,
      $or: [
        { refreshToken },
        { previousRefreshToken: refreshToken }
      ]
    });

    if (!session) {
      // If blacklisted or not in session, reject
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: Session not found or expired'
      });
    }

    const isGraceWindowHit = session.previousRefreshToken === refreshToken &&
      session.previousRotatedAt &&
      (Date.now() - new Date(session.previousRotatedAt).getTime() < REFRESH_GRACE_PERIOD_MS);

    // 3. If not in grace window and token is blacklisted, reject
    if (!isGraceWindowHit && await isTokenBlacklisted(refreshToken)) {
      await logSecurityEvent({
        action: 'invalid_token',
        event,
        metadata: { reason: 'Refresh token is blacklisted and grace period expired' },
        severity: 'high'
      });
      throw createError({
        statusCode: 401,
        statusMessage: 'Refresh token has been revoked'
      });
    }

    // 4. Fetch User
    const user = await User.findById(decoded.id);
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
    const reqFirmId = getHeader(event, 'x-firm-id') || getHeader(event, 'X-Firm-ID');
    const targetFirmId = reqFirmId || (user.firms && user.firms.length > 0 ? ((user.firms[0]?.firm as any)?._id?.toString() || user.firms[0]?.firm?.toString()) : undefined);
    const targetMembership = (user.firms || []).find((f: any) => ((f.firm as any)?._id?.toString() || f.firm?.toString()) === targetFirmId);
    const targetGrade = targetMembership?.grade;

    const newAccessToken = generateAccessToken(user, deviceFingerprint, targetFirmId, targetGrade);
    let effectiveRefreshToken = session.refreshToken;

    // 6. Handle Token Rotation if this is a primary token refresh (not a grace-period retry)
    const shouldRotate = process.env.ROTATE_REFRESH_TOKEN === 'true';
    if (shouldRotate && !isGraceWindowHit) {
      const newRefreshToken = generateRefreshToken(user, deviceFingerprint);
      
      session.previousRefreshToken = refreshToken;
      session.previousRotatedAt = new Date();
      session.refreshToken = newRefreshToken;
      session.expiresAt = new Date(Date.now() + SESSION_TTL_MS);
      effectiveRefreshToken = newRefreshToken;
    } else {
      session.expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    }

    // 7. Update session metadata
    const clientIP = getRequestIP(event, { xForwardedFor: true }) || 'unknown';
    const userAgent = getHeader(event, 'user-agent') || 'unknown';
    
    session.ipAddress = clientIP;
    session.userAgent = userAgent;
    session.deviceInfo = parseDeviceInfo(userAgent);
    session.location = getLocationFromIP(clientIP);
    session.lastActivity = new Date();
    await session.save();

    // 8. Log refresh event
    await logSecurityEvent({
      userId: user._id.toString(),
      email: user.email,
      action: 'token_refresh',
      event,
      metadata: { gracePeriod: isGraceWindowHit },
      severity: 'low'
    });

    // 9. Set refreshed cookies with HttpOnly
    const isProduction = process.env.NODE_ENV === 'production';
    setCookie(event, 'access_token', newAccessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 // 15 minutes
    });

    setCookie(event, 'refresh_token', effectiveRefreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    });

    return {
      accessToken: newAccessToken,
      refreshToken: effectiveRefreshToken
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
