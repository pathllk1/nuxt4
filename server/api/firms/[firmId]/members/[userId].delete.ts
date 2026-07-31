import { defineEventHandler, createError } from 'h3';
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

    const currentUser = await User.findById(currentUserId);
    const currentFirmAssignment = currentUser?.firms.find(f => f.firm.toString() === firmId);
    const currentGrade = currentFirmAssignment?.grade;

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

    targetUser.firms = targetUser.firms.filter(f => f.firm.toString() !== firmId);

    if (targetUser.firms.length === 0 && targetUser.role === 'standard') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot remove user from all firms'
      });
    }

    await targetUser.save();

    return {
      success: true,
      statusCode: 200,
      message: 'Member removed successfully'
    };
  } catch (error: any) {
    console.error('Remove member error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error removing member'
    });
  }
});
