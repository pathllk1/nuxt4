import { defineEventHandler, createError } from 'h3';
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

    const users = await User.find({
      'firms.firm': firmId
    }).select('_id name email role status firms');

    const members = users.map(user => {
      const firmAssignment = user.firms.find(f => f.firm.toString() === firmId);
      return {
        userId: user._id,
        name: user.name,
        email: user.email,
        grade: firmAssignment?.grade || 'Staff',
        status: user.status || 'active',
        role: user.role
      };
    });

    return {
      success: true,
      statusCode: 200,
      members
    };
  } catch (error: any) {
    console.error('Get members error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error fetching members'
    });
  }
});
