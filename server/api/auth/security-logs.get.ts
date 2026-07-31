import { defineEventHandler, createError, getQuery } from 'h3';
import SecurityLog from '../../models/SecurityLog';

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const limit = query.limit ? parseInt(query.limit as string, 10) : 5;

    const logs = await SecurityLog.find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return {
      success: true,
      statusCode: 200,
      logs
    };
  } catch (error: any) {
    console.error('Get security logs error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error fetching security logs'
    });
  }
});
