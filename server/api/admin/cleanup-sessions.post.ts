import { defineEventHandler } from 'h3';
import { requireSuperAdmin } from '../../utils/admin-guard';
import { cleanupExpiredData, cleanupInactiveSessions } from '../../utils/session-cleanup';

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event);
  
  const expiredResult = await cleanupExpiredData();
  const inactiveResult = await cleanupInactiveSessions(30);
  
  return {
    success: true,
    message: 'Cleanup completed successfully',
    deleted: {
      expiredSessions: expiredResult.sessions,
      expiredTokens: expiredResult.blacklist,
      oldLogs: expiredResult.logs,
      inactiveSessions: inactiveResult
    }
  };
});
