import { defineEventHandler, createError } from 'h3';
import { requireSuperAdmin } from '~~/server/utils/admin-guard';
import User from '~~/server/models/User';
import { connectDB } from '~~/server/utils/db';

export default defineEventHandler(async (event) => {
  const currentAdmin = await requireSuperAdmin(event);
  await connectDB();

  const userId = event.context.params?.userId;
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: 'User ID is required' });
  }

  if (userId === currentAdmin.id) {
    throw createError({ statusCode: 400, statusMessage: 'You cannot delete your own admin account' });
  }

  try {
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      throw createError({ statusCode: 404, statusMessage: 'User not found' });
    }

    return {
      success: true,
      message: 'User deleted successfully'
    };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Error deleting user'
    });
  }
});
