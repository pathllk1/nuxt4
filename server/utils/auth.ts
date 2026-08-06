import { H3Event, getHeader, createError } from 'h3';
import mongoose from 'mongoose';
import User from '../models/User';

export interface AuthSession {
  firm_id: any;
  _id: any;
  username?: string;
  email?: string;
}

export async function requireAuthSession(event: H3Event): Promise<AuthSession> {
  const userPayload = event.context.user;
  const userId = userPayload?.id || userPayload?._id || getHeader(event, 'x-user-id');

  if (!userId) {
    throw createError({ 
      statusCode: 401, 
      statusMessage: 'Unauthorized: No user context provided' 
    });
  }

  // Determine firm ID: prefer header override, then JWT claim
  const headerFirmId = getHeader(event, 'x-firm-id') || getHeader(event, 'X-Firm-ID');
  const firmId = headerFirmId || userPayload?.firm_id;

  if (!firmId || firmId === 'undefined' || firmId === 'null') {
    throw createError({ 
      statusCode: 401, 
      statusMessage: 'Unauthorized: No firm context provided' 
    });
  }

  // Fix #6: Validate that the authenticated user actually belongs to the requested firm
  // This prevents IDOR where a user sets x-firm-id to another firm's ID
  const firmOid = new mongoose.Types.ObjectId(String(firmId));
  const userDoc = await User.findOne({
    _id: new mongoose.Types.ObjectId(String(userId)),
    'firms.firm': firmOid
  }).lean();

  if (!userDoc) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: You do not have access to this firm'
    });
  }

  return {
    firm_id: firmOid,
    _id: new mongoose.Types.ObjectId(String(userId)),
    username: userPayload?.username,
    email: userPayload?.email
  };
}
