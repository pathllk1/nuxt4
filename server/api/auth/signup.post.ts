import { defineEventHandler, readBody, createError, getRequestIP } from 'h3';
import User from '../../models/User';
import Firm from '../../models/Firm';
import { logSecurityEvent } from '../../utils/security';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { name, email, password, firmId } = body || {};

  try {
    // 1. Inputs validation
    if (!name || !email || !password) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Name, email, and password are required'
      });
    }

    if (password.length < 8) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Password must be at least 8 characters long'
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      await logSecurityEvent({
        email,
        action: 'login_failed',
        event,
        metadata: { reason: 'User already exists' },
        severity: 'low'
      });
      
      throw createError({
        statusCode: 400,
        statusMessage: 'User already exists'
      });
    }

    if (!firmId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Firm selection is required'
      });
    }

    // 2. Check if firm exists
    const firm = await Firm.findById(firmId);
    if (!firm) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Selected firm not found'
      });
    }

    // 3. Create User with firm link and status 'pending'
    const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown';
    const user = new User({
      name,
      email,
      password,
      role: 'standard',
      firms: [{ firm: firm._id, grade: 'Staff' }],
      securitySettings: {
        failedLoginAttempts: 0,
        trustedIPs: [ip],
        suspiciousActivityCount: 0
      }
    });

    await user.save();

    // 4. Log successful register
    await logSecurityEvent({
      userId: user._id.toString(),
      email: user.email,
      action: 'signup',
      event,
      metadata: { type: 'signup', status: 'pending' },
      severity: 'low'
    });

    return {
      success: true,
      message: 'Registration successful. Your account is pending administrator approval before you can log in.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        firms: [{ firm: { id: firm._id, name: firm.name }, grade: 'Staff' }]
      }
    };
  } catch (error: any) {
    if (error.statusCode) {
      throw error;
    }
    
    console.error('Signup API error:', error);
    await logSecurityEvent({
      email,
      action: 'login_failed',
      event,
      metadata: { reason: 'Server error', error: String(error) },
      severity: 'high'
    });
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Server error during signup'
    });
  }
});
