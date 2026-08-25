import { defineEventHandler, createError } from 'h3';
import User from '../../../models/User';
import { connectDB } from '../../../plugins/mongodb';

export default defineEventHandler(async (event) => {
  await connectDB();

  const userContext = event.context.user;
  if (!userContext || !userContext.id) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: User session required'
    });
  }

  const user = await User.findById(userContext.id).select('firebaseUid firebaseEmail role').lean() as any;
  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User not found'
    });
  }

  return {
    isLinked: Boolean(user.firebaseUid),
    firebaseUid: user.firebaseUid || null,
    firebaseEmail: user.firebaseEmail || null,
    isSuperadmin: user.role === 'superadmin'
  };
});
