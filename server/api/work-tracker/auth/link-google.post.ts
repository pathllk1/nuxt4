import { defineEventHandler, readBody, createError } from 'h3';
import User from '../../../models/User';
import { connectDB } from '../../../plugins/mongodb';
import { verifyFirebaseIdToken } from '../../../utils/firebase';
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

  const body = await readBody(event).catch(() => ({}));
  const idToken = body?.idToken;

  if (!idToken || typeof idToken !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request: Firebase Google idToken is required'
    });
  }

  try {
    // Verify ID token with Firebase Admin
    const decodedToken = await verifyFirebaseIdToken(idToken);
    const firebaseUid = decodedToken.uid;
    const firebaseEmail = decodedToken.email || '';

    if (!firebaseUid) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid ID token: missing UID claim'
      });
    }

    // Save to user document
    const user = await User.findById(userContext.id);
    if (!user) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found'
      });
    }

    user.firebaseUid = firebaseUid;
    user.firebaseEmail = firebaseEmail;
    await user.save();

    // Update current event context
    if (event.context.userDoc) {
      event.context.userDoc.firebaseUid = firebaseUid;
      event.context.userDoc.firebaseEmail = firebaseEmail;
    }

    await logSecurityEvent({
      userId: user._id.toString(),
      email: user.email,
      action: 'firebase_linked',
      event,
      metadata: { firebaseUid, firebaseEmail },
      severity: 'low'
    });

    return {
      success: true,
      message: 'Google Account linked successfully to Work Tracker',
      firebaseUid,
      firebaseEmail
    };
  } catch (error: any) {
    if (error.statusCode) throw error;
    console.error('Failed to link Google account with Firebase:', error);
    throw createError({
      statusCode: 401,
      statusMessage: error.message || 'Failed to verify Google / Firebase authentication token'
    });
  }
});
