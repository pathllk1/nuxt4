import { H3Event, getHeader, createError } from 'h3';
import mongoose from 'mongoose';

export interface AuthSession {
  firm_id: any;
  _id: any;
  username?: string;
  email?: string;
}

export async function requireAuthSession(event: H3Event): Promise<AuthSession> {
  const userPayload = event.context.user;
  const userId = userPayload?.id || userPayload?._id || getHeader(event, 'x-user-id');
  
  const headerFirmId = getHeader(event, 'x-firm-id') || getHeader(event, 'X-Firm-ID');
  const firmId = headerFirmId || userPayload?.firm_id;

  if (!userId) {
    throw createError({ 
      statusCode: 401, 
      statusMessage: 'Unauthorized: No user context provided' 
    });
  }

  if (!firmId || firmId === 'undefined' || firmId === 'null') {
    throw createError({ 
      statusCode: 401, 
      statusMessage: 'Unauthorized: No firm context provided' 
    });
  }

  return {
    firm_id: new mongoose.Types.ObjectId(String(firmId)),
    _id: new mongoose.Types.ObjectId(String(userId)),
    username: userPayload?.username,
    email: userPayload?.email
  };
}
