import { H3Event, createError } from 'h3';
import User from '../models/User';

export async function requireSuperAdmin(event: H3Event): Promise<{ id: string; email: string; role: string }> {
  const userPayload = event.context.user;
  const userId = userPayload?.id || userPayload?._id;

  if (!userId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: Authentication required'
    });
  }

  // Double check role from DB or token
  let role = userPayload?.role;
  if (!role) {
    const userDoc = await User.findById(userId).select('role').lean();
    role = userDoc?.role;
  }

  if (role !== 'superadmin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: Superadmin access required'
    });
  }

  return {
    id: String(userId),
    email: userPayload?.email || '',
    role: 'superadmin'
  };
}
