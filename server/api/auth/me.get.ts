import { defineEventHandler, createError } from 'h3';
import User from '../../models/User';
import Firm from '../../models/Firm';
import { connectDB } from '../../plugins/mongodb';

/**
 * /api/auth/me - Authenticated user profile endpoint.
 * Protected & auto-refreshed by server/middleware/auth.global.ts.
 */
export default defineEventHandler(async (event) => {
  await connectDB();

  const userContext = event.context.user;
  if (!userContext || !userContext.id) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: No user session context'
    });
  }

  // Fetch full user with populated firms
  const user = await User.findById(userContext.id)
    .select('-password -securitySettings')
    .populate({ path: 'firms.firm', model: Firm })
    .lean() as any;

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
});
