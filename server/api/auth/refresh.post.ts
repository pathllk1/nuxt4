import { defineEventHandler, readBody, createError, getCookie, setCookie } from 'h3';
import { connectDB } from '../../plugins/mongodb';
import { performTokenRefresh } from '../../services/authService';

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
    // Delegate to centralized auth service (handles atomic locking, grace window, reuse detection, etc.)
    const result = await performTokenRefresh(refreshToken, event);

    // Set refreshed cookies with HttpOnly
    const isProduction = process.env.NODE_ENV === 'production';
    setCookie(event, 'access_token', result.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/',
      maxAge: 15 * 60 // 15 minutes
    });

    // Only set refresh_token cookie if this instance won the distributed lock.
    // Losers MUST NOT set it — prevents last-write-wins clobbering.
    if (!result.isLockLoser) {
      setCookie(event, 'refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 24 * 30 // 30 days
      });
    }

    // SEC-06: Do not return raw tokens in JSON body — they are in HttpOnly cookies
    return {
      success: true
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
