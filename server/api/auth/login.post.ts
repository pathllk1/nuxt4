import { defineEventHandler, readBody, createError, getHeader, getRequestIP } from 'h3';
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
  detectSuspiciousActivity
} from '../../utils/security';

export default defineEventHandler(async (event) => {
  await connectDB();
  const body = await readBody(event);
  const { email, password } = body || {};

  try {
    if (!email || !password) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Email and password are required'
      });
    }

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
    if (user.isAccountLocked) {
      const lockedUntil = user.securitySettings?.accountLockedUntil;
      if (lockedUntil && new Date(lockedUntil) > new Date()) {
        await logSecurityEvent({
          userId: user._id.toString(),
          email: user.email,
          action: 'login_failed',
          event,
          metadata: { reason: 'Account locked', lockedUntil },
          severity: 'high'
        });
        
        throw createError({
          statusCode: 403,
          statusMessage: 'Account locked due to multiple failed login attempts. Please try again later.'
        });
      } else {
        // Lock expired, unlock
        user.isAccountLocked = false;
        if (user.securitySettings) {
          user.securitySettings.accountLockedUntil = undefined;
        }
        await user.save();
      }
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

    // Save active Session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const userAgent = getHeader(event, 'user-agent') || 'unknown';
    const clientIP = getRequestIP(event, { xForwardedFor: true }) || 'unknown';
    const deviceInfo = parseDeviceInfo(userAgent);
    // Enforce max active session limit (RT-B12)
    const MAX_ACTIVE_SESSIONS = 5;
    const activeSessions = await Session.find({ userId: user._id, isActive: true }).sort({ createdAt: 1 });
    if (activeSessions.length >= MAX_ACTIVE_SESSIONS) {
      const excessCount = activeSessions.length - MAX_ACTIVE_SESSIONS + 1;
      const sessionsToDeactivate = activeSessions.slice(0, excessCount);
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
      refreshToken,
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

    const firmsMapped = (user.firms || [])
      .filter((f: any) => Boolean(f && f.firm))
      .map((f: any) => ({
        firm: { 
          id: typeof f.firm === 'object' ? (f.firm._id || f.firm.id) : f.firm, 
          name: typeof f.firm === 'object' ? (f.firm.name || 'Selected Firm') : 'Selected Firm' 
        },
        grade: f.grade || 'Staff'
      }));

    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        firms: firmsMapped
      },
      accessToken,
      refreshToken
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
      statusMessage: error.message || 'Server error during login'
    });
  }
});
