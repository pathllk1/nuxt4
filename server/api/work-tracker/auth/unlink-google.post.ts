import { defineEventHandler, createError } from 'h3';
import User from '../../../models/User';
import { connectDB } from '../../../plugins/mongodb';
import { logSecurityEvent } from '../../../utils/security';

export default defineEventHandler(async (event) => {
  await connectDB();

  const userContext = event.context.user;
  if (!userContext || !userContext.id) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: User session required'
    });
  }

  const user = await User.findById(userContext.id);
  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User not found'
    });
  }

  const prevUid = user.firebaseUid;
  user.firebaseUid = undefined;
  user.firebaseEmail = undefined;
  await user.save();

  if (event.context.userDoc) {
    event.context.userDoc.firebaseUid = undefined;
    event.context.userDoc.firebaseEmail = undefined;
  }

  await logSecurityEvent({
    userId: user._id.toString(),
    email: user.email,
    action: 'firebase_unlinked',
    event,
    metadata: { previousFirebaseUid: prevUid },
    severity: 'low'
  });

  return {
    success: true,
    message: 'Google Account unlinked from Work Tracker'
  };
});
