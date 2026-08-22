import { defineEventHandler, readBody, createError, getHeader, getRequestIP, setCookie } from 'h3';
import User from '../../models/User';
import Firm from '../../models/Firm';
import Session from '../../models/Session';
import { connectDB } from '../../plugins/mongodb';
import { 
  generateAccessToken, 
  generateRefreshToken 
} from '../../utils/jwt';
import { 
  generateDeviceFingerprint, 
  parseDeviceInfo, 
  getLocationFromIP, 
  logSecurityEvent,
  detectSuspiciousActivity,
  hashToken
} from '../../utils/security';
import { recordLoginIP } from '../../utils/trusted-ips';
import { loginSchema, validateBody } from '../../utils/validation';

export default defineEventHandler(async (event) => {
  await connectDB();
  const body = await readBody(event);
  const { email, password } = validateBody(loginSchema, body);

  try {

    const user = await User.findOne({ email } as any).populate({ path: 'firms.firm', model: Firm });
    if (!user) {
      await logSecurityEvent({
        email,
        action: 'login_failed',
        event,
        metadata: { reason: 'User not found' },
        severity: 'low'
      });
      
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid email or password'
      });
    }

    // Check status (except superadmin)
    if (user.role !== 'superadmin') {
      if (user.status === 'pending') {
        await logSecurityEvent({
          userId: user._id.toString(),
          email: user.email,
          action: 'login_failed',
          event,
          metadata: { reason: 'Account pending approval' },
          severity: 'low'
        });
        
        throw createError({
          statusCode: 403,
          statusMessage: 'Your account is pending administrator approval before you can log in.'
        });
      }
      if (user.status === 'suspended') {
        await logSecurityEvent({
          userId: user._id.toString(),
          email: user.email,
          action: 'login_failed',
          event,
          metadata: { reason: 'Account suspended' },
          severity: 'medium'
        });
        
        throw createError({
          statusCode: 403,
          statusMessage: 'Your account has been suspended by an administrator.'
        });
      }
    }

    // Check account lockout
    const isLocked = await user.checkAndUnlockAccount();
    if (isLocked) {
      await logSecurityEvent({
        userId: user._id.toString(),
        email: user.email,
        action: 'login_failed',
        event,
        metadata: { 
          reason: 'Account locked', 
          lockedUntil: user.securitySettings?.accountLockedUntil 
        },
        severity: 'high'
      });
      
      throw createError({
        statusCode: 403,
        statusMessage: 'Account locked due to multiple failed login attempts. Please try again later.'
      });
    }

    // Compare passwords
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      await user.incrementFailedLogins();
      
      await logSecurityEvent({
        userId: user._id.toString(),
        email: user.email,
        action: 'login_failed',
        event,
        metadata: { 
          reason: 'Invalid password',
          failedAttempts: user.securitySettings?.failedLoginAttempts || 0 
        },
        severity: (user.securitySettings?.failedLoginAttempts || 0) >= 3 ? 'high' : 'medium'
      });

      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid email or password'
      });
    }

    // Reset failed logins
    await user.resetFailedLogins();

    // Detect suspicious geography/device activity
    const suspiciousCheck = await detectSuspiciousActivity(user._id.toString(), event);
    if (suspiciousCheck.suspicious) {
      await logSecurityEvent({
        userId: user._id.toString(),
        email: user.email,
        action: 'suspicious_activity',
        event,
        metadata: { reason: suspiciousCheck.reason },
        severity: 'critical'
      });

      if (user.securitySettings) {
        user.securitySettings.suspiciousActivityCount = (user.securitySettings.suspiciousActivityCount || 0) + 1;
        await user.save();
      }
    }

    // Generate credentials
    const deviceFingerprint = generateDeviceFingerprint(event);
    const accessToken = generateAccessToken(user, deviceFingerprint);
    const refreshToken = generateRefreshToken(user, deviceFingerprint);

    // Save active Session (30 days TTL)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const userAgent = getHeader(event, 'user-agent') || 'unknown';
    const clientIP = getRequestIP(event, { xForwardedFor: true }) || 'unknown';
    const deviceInfo = parseDeviceInfo(userAgent);
    // Enforce max active session limit (RT-B12)
    const MAX_ACTIVE_SESSIONS = parseInt(process.env.MAX_ACTIVE_SESSIONS || '10', 10);  // Increased from 5 to 10
    const activeSessions = await Session.find({ 
      userId: user._id, 
      isActive: true 
    }).sort({ lastActivity: 1 });  // Sort by lastActivity (oldest first)
    
    if (activeSessions.length >= MAX_ACTIVE_SESSIONS) {
      const excessCount = activeSessions.length - MAX_ACTIVE_SESSIONS + 1;
      const sessionsToDeactivate = activeSessions.slice(0, excessCount);  // Deactivate least recently used
      console.log(`[Login] Deactivating ${sessionsToDeactivate.length} old sessions for user ${user._id}`);
      for (const s of sessionsToDeactivate) {
        s.isActive = false;
        s.revokedAt = new Date();
        s.revokedReason = 'Exceeded maximum active sessions limit';
        await s.save();
      }
    }

    const location = getLocationFromIP(clientIP);

    await Session.create({
      userId: user._id,
      refreshToken: hashToken(refreshToken),
      deviceFingerprint,
      ipAddress: clientIP,
      userAgent,
      deviceInfo,
      location,
      isActive: true,
      lastActivity: new Date(),
      expiresAt
    });

    // Log successful login
    await logSecurityEvent({
      userId: user._id.toString(),
      email: user.email,
      action: 'login_success',
      event,
      metadata: { deviceInfo, location },
      severity: 'low'
    });

    // Fix #23: Record login IP in trustedIPs
    await recordLoginIP(user._id.toString(), event);

    const firmsMapped = (user.firms || [])
      .filter((f: any) => Boolean(f && f.firm))
      .map((f: any) => ({
        firm: { 
          id: typeof f.firm === 'object' ? (f.firm._id || f.firm.id) : f.firm, 
          name: typeof f.firm === 'object' ? (f.firm.name || 'Selected Firm') : 'Selected Firm' 
        },
        grade: f.grade || 'Staff'
      }));

    // Set HttpOnly cookies for security (15m for access token, 30d for refresh token)
    const isProduction = process.env.NODE_ENV === 'production';
    setCookie(event, 'access_token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict', // Strict for CSRF protection
      path: '/',
      maxAge: 15 * 60 // 15 minutes (matches JWT expiry)
    });
    setCookie(event, 'refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict', // Strict for CSRF protection
      path: '/',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    });

    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        firms: firmsMapped
      }
    };
  } catch (error: any) {
    if (error.statusCode) {
      throw error;
    }
    
    console.error('Login API error:', error);
    await logSecurityEvent({
      email,
      action: 'login_failed',
      event,
      metadata: { reason: 'Server error', error: String(error) },
      severity: 'high'
    });

    throw createError({
      statusCode: 500,
      statusMessage: 'An internal error occurred'
    });
  }
});
