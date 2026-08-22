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

  // Determine firm ID: prefer header override, then JWT claim (firmId or firm_id)
  const headerFirmId = getHeader(event, 'x-firm-id') || getHeader(event, 'X-Firm-ID');
  const firmId = headerFirmId || userPayload?.firmId || userPayload?.firm_id;

  if (!firmId || firmId === 'undefined' || firmId === 'null') {
    throw createError({ 
      statusCode: 401, 
      statusMessage: 'Unauthorized: No firm context provided' 
    });
  }

  if (!mongoose.Types.ObjectId.isValid(String(firmId)) || !mongoose.Types.ObjectId.isValid(String(userId))) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request: Invalid firm or user identifier format'
    });
  }

  const firmOid = new mongoose.Types.ObjectId(String(firmId));
  const userOid = new mongoose.Types.ObjectId(String(userId));
  // SEC-10: Reuse user document from middleware if available (avoids redundant DB query)
  const userDoc: any = event.context.userDoc || await User.findById(userOid).lean();

  if (!userDoc) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: User not found'
    });
  }

  const hasAccess = userDoc.role === 'superadmin' || 
    (userDoc.firms && userDoc.firms.some((f: any) => 
      String(f.firm?._id || f.firm) === String(firmOid)
    ));

  if (!hasAccess) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: You do not have access to this firm'
    });
  }

  return {
    firm_id: firmOid,
    _id: userOid,
    username: userPayload?.username || userDoc.name,
    email: userPayload?.email || userDoc.email
  };
}
