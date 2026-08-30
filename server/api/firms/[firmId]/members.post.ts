import { defineEventHandler, createError, readBody } from 'h3';
import crypto from 'crypto';
import User from '../../../models/User';

export default defineEventHandler(async (event) => {
  try {
    const firmId = event.context.params?.firmId;
    if (!firmId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Firm ID is required'
      });
    }

    const currentUserId = event.context.user?.id;
    if (!currentUserId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized'
      });
    }

    // Get current user's grade in this firm
    const currentUser = await User.findById(currentUserId);
    const currentFirmAssignment = currentUser?.firms.find(f => f.firm.toString() === firmId);
    const currentGrade = currentFirmAssignment?.grade;
    const currentRole = currentUser?.role;

    const isSuperAdmin = currentRole === 'superadmin';
    if (!isSuperAdmin && !['Owner', 'Admin'].includes(currentGrade || '')) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Insufficient permissions: Firm Owner, Admin, or Superadmin privileges required'
      });
    }

    const { email, grade, name, password } = await readBody(event) || {};
    if (!email || !grade) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Email and Grade are required'
      });
    }

    if (!['Owner', 'Admin', 'Manager', 'Staff'].includes(grade)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid grade'
      });
    }

    let user = await User.findOne({ email: email.toLowerCase() });
    let isNewUser = false;

    if (!user) {
      // Security: Generate a secure cryptographic temporary password instead of static default
      const tempPassword = password || crypto.randomBytes(16).toString('hex');

      user = new User({
        name: name || email.split('@')[0],
        email: email.toLowerCase(),
        password: tempPassword,
        role: 'standard', // Firm invitation can only create standard users
        status: 'active',
        firms: [{ firm: firmId, grade }],
        securitySettings: {
          failedLoginAttempts: 0,
          trustedIPs: [],
          suspiciousActivityCount: 0
        }
      });
      isNewUser = true;
      await user.save();
    } else {
      const hasAccess = user.firms.some(f => f.firm.toString() === firmId);
      if (hasAccess) {
        throw createError({
          statusCode: 400,
          statusMessage: 'User already has access to this firm'
        });
      }

      user.firms.push({
        firm: firmId as any,
        grade: grade as any
      });
      // Security: Do NOT mutate global account status (e.g. un-suspending suspended users)
      await user.save();
    }

    return {
      success: true,
      statusCode: 201,
      message: isNewUser ? 'User created and added to firm successfully' : 'Member added successfully',
      member: {
        userId: user._id,
        email: user.email,
        name: user.name,
        grade,
        status: user.status
      }
    };
  } catch (error: any) {
    console.error('Add member error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error adding member'
    });
  }
});
