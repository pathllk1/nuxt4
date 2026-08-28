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

// Distributed lock config
const LOCK_TTL_MS = 5000; // 5s safety ceiling — if winner crashes, lock auto-expires
const LOCK_POLL_INTERVAL_MS = 200; // Incremental re-check interval for losers
const LOCK_POLL_MAX_ATTEMPTS = 10; // Max polls before giving up (~2s total)

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  decoded: any;
  user: any;
  isLockLoser?: boolean; // true = loser path, caller MUST NOT set refresh_token cookie
}

/**
 * Helper: sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Centralized token refresh logic — single source of truth.
 * Uses MongoDB atomic CAS lock on Session.refreshLockedUntil for distributed
 * coordination across Vercel serverless instances.
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
  const tokenHash = hashToken(refreshTokenValue);

  // 3. Look up active session by hashed token or raw token (backwards compatibility)
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

  // 4. Check grace window for previousRefreshToken matches
  const isPreviousToken = (session.previousRefreshToken === tokenHash || session.previousRefreshToken === refreshTokenValue);
  const timeSinceRotation = session.previousRotatedAt ? (Date.now() - new Date(session.previousRotatedAt).getTime()) : Infinity;
  const isGraceWindowHit = isPreviousToken && (timeSinceRotation < REFRESH_GRACE_PERIOD_MS);

  // Self-Healing Same-Device Recovery:
  // If stale token arrives outside grace window, check if it's the same device.
  // Same device → browser slept and missed the Set-Cookie → self-heal by re-issuing fresh tokens.
  // Different device → log anomaly (fingerprint is a weak signal, not a hard gate).
  const isSelfHeal = isPreviousToken && !isGraceWindowHit;
  if (isSelfHeal) {
    const requestFingerprint = generateDeviceFingerprint(event);
    const isSameDevice = session.deviceFingerprint === requestFingerprint;

    if (!isSameDevice) {
      // Fingerprint mismatch — likely browser auto-update during idle, not theft.
      // Log as anomaly and update stored fingerprint to current value.
      // (generateDeviceFingerprint hashes user-agent + accept-language + accept-encoding —
      // its own comment warns: "Do NOT use as a hard security gate.")
      await logSecurityEvent({
        userId: decoded.id,
        action: 'anomaly_detected',
        event,
        metadata: {
          reason: 'Fingerprint mismatch during self-heal (weak signal — allowing recovery)',
          sessionFingerprint: session.deviceFingerprint,
          requestFingerprint
        },
        severity: 'medium'
      });
      // Actually write the updated fingerprint to the DB so subsequent
      // requests don't keep logging the same anomaly forever
      await Session.updateOne(
        { _id: session._id },
        { $set: { deviceFingerprint: requestFingerprint } }
      );
    }

    // SAME device (or updated fingerprint) — browser went to sleep and missed the rotated cookie.
    // Log it and continue to self-heal below (step 8 handles re-rotation).
    await logSecurityEvent({
      userId: decoded.id,
      action: 'token_refresh',
      event,
      metadata: {
        reason: 'Self-healed stale token from same device (idle wakeup recovery)',
        staleSinceMs: timeSinceRotation,
        fingerprintMatched: session.deviceFingerprint === requestFingerprint
      },
      severity: 'low'
    });
  }

  // 5. Fetch and validate user status
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

  // 6. Generate new access token (cheap, no rotation tracking — safe for all paths)
  const reqFirmId = getHeader(event, 'x-firm-id') || getHeader(event, 'X-Firm-ID');
  const targetFirmId = reqFirmId || (user.firms && user.firms.length > 0 
    ? ((user.firms[0]?.firm as any)?._id?.toString() || user.firms[0]?.firm?.toString()) 
    : undefined);
  const targetMembership = (user.firms || []).find((f: any) => 
    ((f.firm as any)?._id?.toString() || f.firm?.toString()) === targetFirmId
  );
  const targetGrade = targetMembership?.grade;

  const newAccessToken = generateAccessToken(user, deviceFingerprint, targetFirmId, targetGrade);

  // 7. Handle Token Rotation with Distributed Lock
  const shouldRotate = process.env.ROTATE_REFRESH_TOKEN === 'true';
  const isWithinCooldown = session.previousRotatedAt && (timeSinceRotation < REFRESH_COOLDOWN_MS);

  let effectiveRawRefreshToken = refreshTokenValue;
  let isLockLoser = false;

  if (shouldRotate && !isWithinCooldown) {
    // --- DISTRIBUTED LOCK: Atomic CAS claim on Session.refreshLockedUntil ---
    const now = new Date();
    const lockExpiry = new Date(Date.now() + LOCK_TTL_MS);

    const lockedSession = await Session.findOneAndUpdate(
      {
        _id: session._id,
        isActive: true,
        $or: [
          { refreshLockedUntil: { $exists: false } },
          { refreshLockedUntil: null },
          { refreshLockedUntil: { $lt: now } }
        ]
      },
      { $set: { refreshLockedUntil: lockExpiry } },
      { returnDocument: 'after' }
    );

    if (lockedSession) {
      // === WINNER PATH: This instance won the CAS lock ===
      try {
        if (isSelfHeal) {
          // Self-heal path: browser slept and missed the last rotation.
          // Generate a fresh rotated token to resynchronize the browser's cookie jar.
          const healedRawToken = generateRefreshToken(user, deviceFingerprint);
          const healedHashedToken = hashToken(healedRawToken);

          await Session.findOneAndUpdate(
            { _id: session._id, isActive: true },
            {
              $set: {
                refreshToken: healedHashedToken,
                previousRefreshToken: lockedSession.refreshToken || session.refreshToken, // current becomes previous
                previousRotatedAt: new Date(),
                lastActivity: new Date(),
                expiresAt: new Date(Date.now() + SESSION_TTL_MS),
                ipAddress: getRequestIP(event, { xForwardedFor: true }) || 'unknown',
                userAgent: getHeader(event, 'user-agent') || 'unknown',
                refreshLockedUntil: null // Release lock on success
              }
            }
          );
          effectiveRawRefreshToken = healedRawToken;
        } else {
          // Normal rotation: generate new raw token & hash it
          const newRawRefreshToken = generateRefreshToken(user, deviceFingerprint);
          const newHashedRefreshToken = hashToken(newRawRefreshToken);

          // Compute exact lineage from the freshest post-CAS-lock document
          const prevTokenToWrite = isGraceWindowHit 
            ? (lockedSession.previousRefreshToken || session.previousRefreshToken) 
            : (lockedSession.refreshToken || tokenHash);
          const prevRotatedAtToWrite = isGraceWindowHit 
            ? (lockedSession.previousRotatedAt || session.previousRotatedAt) 
            : new Date();

          // Atomic update with lock release
          const updatedSession = await Session.findOneAndUpdate(
            {
              _id: session._id,
              isActive: true
            },
            {
              $set: {
                refreshToken: newHashedRefreshToken,
                previousRefreshToken: prevTokenToWrite,
                previousRotatedAt: prevRotatedAtToWrite,
                lastActivity: new Date(),
                expiresAt: new Date(Date.now() + SESSION_TTL_MS),
                ipAddress: getRequestIP(event, { xForwardedFor: true }) || 'unknown',
                userAgent: getHeader(event, 'user-agent') || 'unknown',
                refreshLockedUntil: null // Release lock on success
              }
            },
            { returnDocument: 'after' }
          );

          if (updatedSession) {
            effectiveRawRefreshToken = newRawRefreshToken;
          }
          // If CAS failed (session deactivated mid-flight), keep original token
        }
      } catch (rotationError) {
        // Release lock immediately on ANY failure so losers don't wait the full TTL
        await Session.updateOne(
          { _id: session._id },
          { $set: { refreshLockedUntil: null } }
        ).catch(() => {}); // Best-effort cleanup, don't mask the original error
        throw rotationError;
      }
    } else {
      // === LOSER PATH: Another instance holds the lock ===
      // Wait for the winner to finish, then return access-token-only result.
      isLockLoser = true;

      for (let attempt = 0; attempt < LOCK_POLL_MAX_ATTEMPTS; attempt++) {
        await sleep(LOCK_POLL_INTERVAL_MS);

        const refreshedSession = await Session.findOne({ _id: session._id }).lean();
        if (!refreshedSession) break;

        // Check if lock has been released (winner finished or lock expired)
        const lockReleased = !refreshedSession.refreshLockedUntil || 
                             new Date(refreshedSession.refreshLockedUntil).getTime() <= Date.now();
        if (lockReleased) {
          console.log(`[AuthService] Joined distributed lock after ${(attempt + 1) * LOCK_POLL_INTERVAL_MS}ms — returning access token only`);
          break;
        }
      }

      // Return the original refresh token — caller will NOT set refresh_token cookie.
      // The winner's response (a different HTTP response in this burst) will be the
      // sole source of truth for the browser's refresh_token cookie.
      effectiveRawRefreshToken = refreshTokenValue;
    }
  } else {
    // Within cooldown window or rotation disabled: extend session activity only.
    // Explicitly set isLockLoser = true so caller NEVER overwrites the browser's
    // cookie jar with an older/straggler token.
    isLockLoser = true;
    session.lastActivity = new Date();
    session.expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await session.save();
  }

  // 8. Log refresh event
  await logSecurityEvent({
    userId: user._id.toString(),
    email: user.email,
    action: 'token_refresh',
    event,
    metadata: { 
      gracePeriod: isGraceWindowHit, 
      cooldown: isWithinCooldown,
      lockWinner: !isLockLoser,
      selfHeal: isSelfHeal
    },
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
    user,
    isLockLoser
  };
}
