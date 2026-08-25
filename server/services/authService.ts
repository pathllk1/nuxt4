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
  blacklistToken,
  revokeAllSessions,
  hashToken
} from '../utils/security';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const REFRESH_GRACE_PERIOD_MS = 30 * 1000; // 30 seconds
const REFRESH_COOLDOWN_MS = 15 * 1000; // 15 seconds (prevents rapid double-rotation churn on parallel requests)

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  decoded: any;
  user: any;
}

// Server-side in-flight single-flight lock map (keyed by user ID + device fingerprint)
// Ensures parallel requests from the same browser join the exact same promise without cross-device interference!
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
  // 1. Check if refresh token is blacklisted
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

  // 2. Verify JWT signature and claims
  let decoded: any;
  try {
    decoded = verifyRefreshToken(refreshTokenValue);
  } catch (jwtErr: any) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid or expired refresh token'
    });
  }

  const deviceFingerprint = generateDeviceFingerprint(event);
  const lockKey = `${decoded.id}:${deviceFingerprint}`;
  const tokenHash = hashToken(refreshTokenValue);

  // 3. Single-Flight Lock keyed by userId + deviceFingerprint
  // If another parallel request on the SAME device is already refreshing, await the in-flight promise!
  const existingPromise = inFlightRefreshes.get(lockKey);
  if (existingPromise) {
    return await existingPromise;
  }

  const refreshPromise = (async () => {
    // 4. Look up active session by hashed token or raw token (backwards compatibility)
    const session = await Session.findOne({
      userId: decoded.id,
      isActive: true,
      $or: [
        { refreshToken: tokenHash },
        { previousRefreshToken: tokenHash },
        { refreshToken: refreshTokenValue },
        { previousRefreshToken: refreshTokenValue }
      ]
    });

    if (!session) {
      // Diagnostic check: token does not match any active session
      const anySession = await Session.findOne({ userId: decoded.id })
        .sort({ createdAt: -1 })
        .lean();

      if (anySession && !anySession.isActive) {
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
    const isPreviousToken = (session.previousRefreshToken === tokenHash || session.previousRefreshToken === refreshTokenValue);
    const timeSinceRotation = session.previousRotatedAt ? (Date.now() - new Date(session.previousRotatedAt).getTime()) : Infinity;
    const isGraceWindowHit = isPreviousToken && (timeSinceRotation < REFRESH_GRACE_PERIOD_MS);

    // Self-Healing Same-Device Recovery:
    // If stale token arrives outside grace window, check if it's the same device.
    // Same device → browser slept and missed the Set-Cookie → self-heal by re-issuing fresh tokens.
    // Different device → genuine token theft → revoke all sessions.
    const isSelfHeal = isPreviousToken && !isGraceWindowHit;
    if (isSelfHeal) {
      const requestFingerprint = generateDeviceFingerprint(event);
      const isSameDevice = session.deviceFingerprint === requestFingerprint;

      if (!isSameDevice) {
        // DIFFERENT device presenting a rotated-out token = genuine theft
        await revokeAllSessions(decoded.id, 'Refresh token reuse detected from different device');
        await logSecurityEvent({
          userId: decoded.id,
          action: 'suspicious_activity',
          event,
          metadata: {
            reason: 'Previous refresh token used from different device outside grace window — all sessions revoked',
            sessionFingerprint: session.deviceFingerprint,
            requestFingerprint
          },
          severity: 'critical'
        });
        throw createError({
          statusCode: 401,
          statusMessage: 'Unauthorized: Token reuse detected. All sessions have been revoked.'
        });
      }

      // SAME device — browser went to sleep and missed the rotated cookie.
      // Log it and continue to self-heal below (step 8 handles re-rotation).
      await logSecurityEvent({
        userId: decoded.id,
        action: 'token_refresh',
        event,
        metadata: {
          reason: 'Self-healed stale token from same device (idle wakeup recovery)',
          staleSinceMs: timeSinceRotation
        },
        severity: 'low'
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
    const reqFirmId = getHeader(event, 'x-firm-id') || getHeader(event, 'X-Firm-ID');
    const targetFirmId = reqFirmId || (user.firms && user.firms.length > 0 
      ? ((user.firms[0]?.firm as any)?._id?.toString() || user.firms[0]?.firm?.toString()) 
      : undefined);
    const targetMembership = (user.firms || []).find((f: any) => 
      ((f.firm as any)?._id?.toString() || f.firm?.toString()) === targetFirmId
    );
    const targetGrade = targetMembership?.grade;

    const newAccessToken = generateAccessToken(user, deviceFingerprint, targetFirmId, targetGrade);

    // 8. Handle Token Rotation (Atomic with cooldown & grace handling)
    let effectiveRawRefreshToken = refreshTokenValue;
    const shouldRotate = process.env.ROTATE_REFRESH_TOKEN === 'true';
    const isWithinCooldown = session.previousRotatedAt && (timeSinceRotation < REFRESH_COOLDOWN_MS);

    if (isSelfHeal && shouldRotate) {
      // Self-heal path: browser slept and missed the last rotation.
      // We can't reverse the stored hash to recover the current raw token,
      // so generate a fresh rotated token to resynchronize the browser's cookie jar.
      const healedRawToken = generateRefreshToken(user, deviceFingerprint);
      const healedHashedToken = hashToken(healedRawToken);

      await Session.findOneAndUpdate(
        { _id: session._id, isActive: true },
        {
          $set: {
            refreshToken: healedHashedToken,
            previousRefreshToken: session.refreshToken, // current becomes previous
            previousRotatedAt: new Date(),
            lastActivity: new Date(),
            expiresAt: new Date(Date.now() + SESSION_TTL_MS),
            ipAddress: getRequestIP(event, { xForwardedFor: true }) || 'unknown',
            userAgent: getHeader(event, 'user-agent') || 'unknown'
          }
        }
      );
      effectiveRawRefreshToken = healedRawToken;
    } else if (shouldRotate && !isWithinCooldown) {
      // Normal rotation: generate new raw token & hash it
      const newRawRefreshToken = generateRefreshToken(user, deviceFingerprint);
      const newHashedRefreshToken = hashToken(newRawRefreshToken);

      // Perform atomic compare-and-swap (CAS)
      const updatedSession = await Session.findOneAndUpdate(
        {
          _id: session._id,
          isActive: true
        },
        {
          $set: {
            refreshToken: newHashedRefreshToken,
            previousRefreshToken: isGraceWindowHit ? session.previousRefreshToken : tokenHash,
            previousRotatedAt: isGraceWindowHit ? session.previousRotatedAt : new Date(),
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
        effectiveRawRefreshToken = refreshTokenValue;
      }
    } else {
      // Within cooldown window or rotation disabled: extend session activity
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
      metadata: { gracePeriod: isGraceWindowHit, cooldown: isWithinCooldown },
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

  // Set the lock immediately after promise creation so concurrent requests coalesce
  inFlightRefreshes.set(lockKey, refreshPromise);
  try {
    return await refreshPromise;
  } finally {
    // Retain in map for 2 seconds to coalesce rapid back-to-back requests, then delete
    setTimeout(() => {
      inFlightRefreshes.delete(lockKey);
    }, 2000);
  }
}
