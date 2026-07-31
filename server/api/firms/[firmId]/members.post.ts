import { defineEventHandler, createError, readBody } from 'h3';
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

    if (!['Owner', 'Admin'].includes(currentGrade || '')) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Insufficient permissions'
      });
    }

    const { email, grade, name, password, status, role } = await readBody(event) || {};
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

    if (role === 'superadmin' && currentRole !== 'superadmin') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Only system superadmins can assign the superadmin role'
      });
    }

    let user = await User.findOne({ email: email.toLowerCase() });
    let isNewUser = false;

    if (!user) {
      user = new User({
        name: name || email.split('@')[0],
        email: email.toLowerCase(),
        password: password || 'Welcome@123',
        role: role || 'standard',
        status: status || 'active',
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
      if (status) {
        user.status = status as any;
      }
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
