import { defineEventHandler, createError, readBody } from 'h3';
import User from '../../../../models/User';

export default defineEventHandler(async (event) => {
  try {
    const firmId = event.context.params?.firmId;
    const targetUserId = event.context.params?.userId;
    if (!firmId || !targetUserId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Firm ID and User ID are required'
      });
    }

    const currentUserId = event.context.user?.id;
    if (!currentUserId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized'
      });
    }

    // Get current user's grade and role
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

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found'
      });
    }

    if (targetUser.role === 'superadmin' && currentRole !== 'superadmin') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Cannot modify system superadmin users'
      });
    }

    const targetFirmAssignment = targetUser.firms.find(f => f.firm.toString() === firmId);
    if (!targetFirmAssignment) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User does not have access to this firm'
      });
    }

    if (targetFirmAssignment.grade === 'Owner' && currentGrade !== 'Owner') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Admins cannot modify the Owner of the firm'
      });
    }

    const { grade, status, name, email, role } = await readBody(event) || {};

    if (targetUserId === currentUserId) {
      if (status && status !== targetUser.status) {
        throw createError({ statusCode: 400, statusMessage: 'You cannot change your own status' });
      }
      if (grade && grade !== targetFirmAssignment.grade) {
        throw createError({ statusCode: 400, statusMessage: 'You cannot change your own grade' });
      }
      if (role && role !== targetUser.role) {
        throw createError({ statusCode: 400, statusMessage: 'You cannot change your own system role' });
      }
    }

    if (grade) {
      if (!['Owner', 'Admin', 'Manager', 'Staff'].includes(grade)) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid grade' });
      }
      targetFirmAssignment.grade = grade as any;
    }

    if (status) {
      if (!['pending', 'active', 'suspended'].includes(status)) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid status' });
      }
      targetUser.status = status as any;
    }

    if (role) {
      if (!['superadmin', 'standard'].includes(role)) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid role' });
      }
      if (role === 'superadmin' && currentRole !== 'superadmin') {
        throw createError({ statusCode: 403, statusMessage: 'Only system superadmins can assign the superadmin role' });
      }
      targetUser.role = role as any;
    }

    if (name) targetUser.name = name;
    if (email) {
      const emailClash = await User.findOne({ email: email.toLowerCase(), _id: { $ne: targetUserId } });
      if (emailClash) {
        throw createError({ statusCode: 409, statusMessage: 'Email already in use by another user' });
      }
      targetUser.email = email.toLowerCase();
    }

    await targetUser.save();

    return {
      success: true,
      statusCode: 200,
      message: 'Member updated successfully',
      member: {
        userId: targetUser._id,
        email: targetUser.email,
        name: targetUser.name,
        grade: targetFirmAssignment.grade,
        status: targetUser.status,
        role: targetUser.role
      }
    };
  } catch (error: any) {
    console.error('Update member error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error updating member'
    });
  }
});
