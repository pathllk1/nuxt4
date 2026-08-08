import { defineEventHandler, createError } from 'h3';
import User from '../../models/User';
import Firm from '../../models/Firm';

export default defineEventHandler(async (event) => {
  const userPayload = event.context.user;
  if (!userPayload) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    });
  }

  try {
    const user = await User.findById(userPayload.id)
      .select('-password -securitySettings')
      .populate({ path: 'firms.firm', model: Firm })
      .lean();

    if (!user) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found'
      });
    }

    const firmsMapped = (user.firms || []).map((f: any) => ({
      firm: f.firm,
      grade: f.grade || 'Staff'
    }));

    return {
      id: user._id.toString(),
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      firms: firmsMapped
    };
  } catch (error: any) {
    console.error('getMe API error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Server error retrieving user data'
    });
  }
});
