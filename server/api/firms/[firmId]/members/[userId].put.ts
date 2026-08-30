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

    const isSuperAdmin = currentRole === 'superadmin';
    if (!isSuperAdmin && !['Owner', 'Admin'].includes(currentGrade || '')) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Insufficient permissions: Firm Owner, Admin, or Superadmin privileges required'
      });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found'
      });
    }

    if (targetUser.role === 'superadmin' && !isSuperAdmin) {
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

    if (targetFirmAssignment.grade === 'Owner' && currentGrade !== 'Owner' && !isSuperAdmin) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Admins cannot modify the Owner of the firm'
      });
    }

    const { grade } = await readBody(event) || {};

    if (targetUserId === currentUserId) {
      if (grade && grade !== targetFirmAssignment.grade) {
        throw createError({ statusCode: 400, statusMessage: 'You cannot change your own grade' });
      }
    }

    if (grade) {
      if (!['Owner', 'Admin', 'Manager', 'Staff'].includes(grade)) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid grade' });
      }
      targetFirmAssignment.grade = grade as any;
    }

    await targetUser.save();

    return {
      success: true,
      statusCode: 200,
      message: 'Member grade updated successfully',
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
