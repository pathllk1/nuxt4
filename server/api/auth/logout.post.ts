import { defineEventHandler, readBody, createError, getHeader, getCookie, setCookie } from 'h3';
import Session from '../../models/Session';
import { connectDB } from '../../plugins/mongodb';
import { verifyRefreshToken, getTokenExpiration } from '../../utils/jwt';
import { blacklistToken, logSecurityEvent } from '../../utils/security';

export default defineEventHandler(async (event) => {
  await connectDB();
  const body = await readBody(event).catch(() => ({}));
  const refreshToken = (body && body.refreshToken) || getCookie(event, 'refresh_token');

  // Always expire cookies on response regardless of token validity
  const isProduction = process.env.NODE_ENV === 'production';
  setCookie(event, 'access_token', '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict', // Strict for CSRF protection
    path: '/',
    maxAge: 0
  });
  setCookie(event, 'refresh_token', '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict', // Strict for CSRF protection
    path: '/',
    maxAge: 0
  });

  if (!refreshToken) {
    return {
      success: true,
      message: 'Logged out successfully'
    };
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

    // Blacklist current access token if provided in authorization headers or cookie
    const authHeader = getHeader(event, 'authorization');
    const accessToken = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.split(' ')[1] : getCookie(event, 'access_token');
    if (accessToken) {
      const accessExp = getTokenExpiration(accessToken) || new Date(Date.now() + 15 * 60 * 1000);
      await blacklistToken(accessToken, 'access', decoded.id, 'User logout', accessExp);
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
    console.error('Logout processing warning:', error);
    return {
      success: true,
      message: 'Logged out successfully'
    };
  }
});
