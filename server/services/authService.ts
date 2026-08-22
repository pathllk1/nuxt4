import { H3Event, getHeader, getRequestIP, createError } from 'h3';
import User from '../models/User';
import Session from '../models/Session';
import {
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  getTokenExpiration
} from '../utils/jwt';
import {
  isTokenBlacklisted,
  logSecurityEvent,
  generateDeviceFingerprint,
  parseDeviceInfo,
  getLocationFromIP,
  blacklistToken,
  revokeAllSessions,
  hashToken
} from '../utils/security';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const REFRESH_GRACE_PERIOD_MS = 30 * 1000; // 30 seconds

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  decoded: any;
  user: any;
}

// Server-side in-flight single-flight lock map (keyed by hashed refresh token)
// Ensures 5-10 parallel requests from the same client join the exact same promise!
const inFlightRefreshes = new Map<string, Promise<RefreshResult>>();

/**
 * Centralized token refresh logic — single source of truth.
 * Single-flight in-flight lock + atomic CAS prevents race conditions from concurrent requests.
 * 
 * Called by:
 *   - server/middleware/auth.global.ts (silent refresh on expired/missing access token)
 *   - server/api/auth/refresh.post.ts (explicit client-initiated refresh)
 */
export async function performTokenRefresh(
  refreshTokenValue: string,
  event: H3Event
): Promise<RefreshResult> {
  const tokenHash = hashToken(refreshTokenValue);

  // 1. Single-Flight Lock: If another parallel request is already refreshing this token, await it!
  const existingPromise = inFlightRefreshes.get(tokenHash);
  if (existingPromise) {
    return await existingPromise;
  }

  const refreshPromise = (async () => {
    // 2. Check if refresh token is blacklisted
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

    // 3. Verify JWT signature and claims
    let decoded: any;
    try {
      decoded = verifyRefreshToken(refreshTokenValue);
    } catch (jwtErr: any) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid or expired refresh token'
      });
    }

    // 4. Look up active session by hashed token (either current or previous within grace window)
    const session = await Session.findOne({
      userId: decoded.id,
      isActive: true,
      $or: [
        { refreshToken: tokenHash },
        { previousRefreshToken: tokenHash }
      ]
    });

    if (!session) {
      // Diagnostic check: did user have an inactive session or is this an unknown token?
      const anySession = await Session.findOne({ userId: decoded.id })
        .sort({ createdAt: -1 })
        .lean();

      if (anySession && !anySession.isActive) {
        // SEC-03: If token doesn't match active session, revoke all sessions for safety
        if (anySession.refreshToken !== tokenHash && 
            anySession.previousRefreshToken !== tokenHash) {
          await revokeAllSessions(decoded.id, 'Refresh token reuse detected');
          await logSecurityEvent({
            userId: decoded.id,
            action: 'suspicious_activity',
            event,
            metadata: { reason: 'Token reuse detected — all sessions revoked' },
            severity: 'critical'
          });
        }

        throw createError({
          statusCode: 401,
          statusMessage: `Session deactivated: ${anySession.revokedReason || 'Session is no longer active'}`
        });
      }

      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: Session not found or expired'
      });
    }

    // 5. Check grace window for previousRefreshToken matches
    const isPreviousToken = session.previousRefreshToken === tokenHash;
    const isGraceWindowHit = isPreviousToken &&
      session.previousRotatedAt &&
      (Date.now() - new Date(session.previousRotatedAt).getTime() < REFRESH_GRACE_PERIOD_MS);

    // If outside grace window and token matched previousRefreshToken, this is token reuse!
    if (isPreviousToken && !isGraceWindowHit) {
      await revokeAllSessions(decoded.id, 'Refresh token reuse detected');
      await logSecurityEvent({
        userId: decoded.id,
        action: 'suspicious_activity',
        event,
        metadata: { reason: 'Previous refresh token used outside grace window — all sessions revoked' },
        severity: 'critical'
      });
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: Token reuse detected. All sessions have been revoked.'
      });
    }

    // 6. Fetch and validate user status
    const user = await User.findById(decoded.id);
    if (!user || user.status === 'suspended' || user.status === 'pending') {
      if (user?.status === 'suspended') {
        const oldExp = getTokenExpiration(refreshTokenValue) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await blacklistToken(refreshTokenValue, 'refresh', decoded.id, 'User suspended', oldExp);
      }
      throw createError({
        statusCode: user?.status === 'suspended' ? 403 : 401,
        statusMessage: user?.status === 'suspended'
          ? 'Your account has been suspended by an administrator.'
          : user?.status === 'pending'
            ? 'Your account is pending administrator approval.'
            : 'Unauthorized: User not found'
      });
    }

    const isLocked = await user.checkAndUnlockAccount();
    if (isLocked) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Account locked due to suspicious activity'
      });
    }

    // 7. Generate new access token
    const deviceFingerprint = generateDeviceFingerprint(event);
    const reqFirmId = getHeader(event, 'x-firm-id') || getHeader(event, 'X-Firm-ID');
    const targetFirmId = reqFirmId || (user.firms && user.firms.length > 0 
      ? ((user.firms[0]?.firm as any)?._id?.toString() || user.firms[0]?.firm?.toString()) 
      : undefined);
    const targetMembership = (user.firms || []).find((f: any) => 
      ((f.firm as any)?._id?.toString() || f.firm?.toString()) === targetFirmId
    );
    const targetGrade = targetMembership?.grade;

    const newAccessToken = generateAccessToken(user, deviceFingerprint, targetFirmId, targetGrade);

    // 8. Handle Token Rotation (Atomic)
    let effectiveRawRefreshToken = refreshTokenValue;
    const shouldRotate = process.env.ROTATE_REFRESH_TOKEN === 'true';

    if (shouldRotate && !isGraceWindowHit) {
      // First rotation for this cycle: generate new raw token & hash it
      const newRawRefreshToken = generateRefreshToken(user, deviceFingerprint);
      const newHashedRefreshToken = hashToken(newRawRefreshToken);

      // Perform atomic compare-and-swap (CAS)
      const updatedSession = await Session.findOneAndUpdate(
        {
          _id: session._id,
          refreshToken: tokenHash, // CAS condition: ensure no other request changed it
          isActive: true
        },
        {
          $set: {
            refreshToken: newHashedRefreshToken,
            previousRefreshToken: tokenHash,
            previousRotatedAt: new Date(),
            lastActivity: new Date(),
            expiresAt: new Date(Date.now() + SESSION_TTL_MS),
            ipAddress: getRequestIP(event, { xForwardedFor: true }) || 'unknown',
            userAgent: getHeader(event, 'user-agent') || 'unknown'
          }
        },
        { returnDocument: 'after' }
      );

      if (updatedSession) {
        effectiveRawRefreshToken = newRawRefreshToken;
      } else {
        // Another thread already updated the session, re-read and reuse
        const currentSession = await Session.findById(session._id);
        if (currentSession && currentSession.isActive) {
          effectiveRawRefreshToken = refreshTokenValue;
        }
      }
    } else {
      // Grace window hit or rotation disabled: extend session activity
      session.lastActivity = new Date();
      session.expiresAt = new Date(Date.now() + SESSION_TTL_MS);
      await session.save();
    }

    // 9. Log refresh event
    await logSecurityEvent({
      userId: user._id.toString(),
      email: user.email,
      action: 'token_refresh',
      event,
      metadata: { gracePeriod: isGraceWindowHit },
      severity: 'low'
    });

    return {
      accessToken: newAccessToken,
      refreshToken: effectiveRawRefreshToken,
      decoded: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        firmId: targetFirmId,
        grade: targetGrade
      },
      user
    };
  })();

  inFlightRefreshes.set(tokenHash, refreshPromise);
  try {
    return await refreshPromise;
  } finally {
    // Keep in map for 2 seconds to catch straggling parallel requests, then release
    setTimeout(() => {
      inFlightRefreshes.delete(tokenHash);
    }, 2000);
  }
}
