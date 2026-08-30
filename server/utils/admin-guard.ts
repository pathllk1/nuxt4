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

  // Double check role from fresh DB doc or context userDoc to prevent stale privilege retention
  let role = event.context.userDoc?.role;
  let status = event.context.userDoc?.status;

  if (!role) {
    const userDoc: any = await User.findById(userId).select('role status').lean();
    role = userDoc?.role;
    status = userDoc?.status;
  }

  if (role !== 'superadmin' || status === 'suspended') {
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
