import { defineEventHandler, createError, getQuery } from 'h3';
import SecurityLog from '../../models/SecurityLog';
import { requireSuperAdmin } from '../../utils/admin-guard';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const userPayload = event.context.user;
    const role = userPayload?.role;

    let userId: string | undefined;

    if (role === 'superadmin') {
      const admin = await requireSuperAdmin(event);
      userId = admin.id;
    } else {
      const session = await requireAuthSession(event);
      userId = session._id.toString();
    }

    const query = getQuery(event);
    const limit = query.limit ? parseInt(query.limit as string, 10) : 5;

    // Non-admin users can only see their own security events
    const filter: Record<string, any> = {};
    if (role !== 'superadmin' && userId) {
      filter.userId = userId;
    }

    const logs = await SecurityLog.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    // Strip sensitive fields for non-admin users
    const sanitizedLogs = role === 'superadmin'
      ? logs
      : logs.map((log: any) => ({
          _id: log._id,
          action: log.action,
          timestamp: log.timestamp,
          severity: log.severity,
          // Strip IP, fingerprint, raw user agent from non-admin view
        }));

    return {
      success: true,
      statusCode: 200,
      logs: sanitizedLogs
    };
  } catch (error: any) {
    console.error('Get security logs error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error fetching security logs'
    });
  }
});
