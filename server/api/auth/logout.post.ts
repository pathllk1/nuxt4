import { defineEventHandler, readBody, createError, getHeader } from 'h3';
import Session from '../../models/Session';
import { verifyRefreshToken, getTokenExpiration } from '../../utils/jwt';
import { blacklistToken, logSecurityEvent } from '../../utils/security';

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
    const decoded = verifyRefreshToken(refreshToken);
    
    // Deactivate session
    const session = await Session.findOne({
      refreshToken,
      userId: decoded.id,
      isActive: true
    } as any);

    if (session) {
      session.isActive = false;
      session.revokedAt = new Date();
      session.revokedReason = 'User logout';
      await session.save();
    }

    // Blacklist the refresh token
    const refreshExp = getTokenExpiration(refreshToken) || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await blacklistToken(refreshToken, 'refresh', decoded.id, 'User logout', refreshExp);

    // Blacklist current access token if provided in authorization headers
    const authHeader = getHeader(event, 'authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const accessToken = authHeader.split(' ')[1];
      const accessExp = getTokenExpiration(accessToken as any) || new Date(Date.now() + 15 * 60 * 1000);
      await blacklistToken(accessToken as any, 'access', decoded.id, 'User logout', accessExp);
    }

    // Log logout event
    await logSecurityEvent({
      userId: decoded.id,
      action: 'logout',
      event,
      severity: 'low'
    });

    return {
      success: true,
      message: 'Logged out successfully'
    };
  } catch (error) {
    console.error('Logout error:', error);
    // Ignore verification errors on logout for UX, just return success
    return {
      success: true,
      message: 'Logged out successfully'
    };
  }
});
