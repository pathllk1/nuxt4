import Session from '../models/Session';
import TokenBlacklist from '../models/TokenBlacklist';
import SecurityLog from '../models/SecurityLog';

/**
 * Clean up expired sessions, blacklisted tokens, and old security logs
 * Run this periodically (e.g., daily cron job or on server startup)
 */
export async function cleanupExpiredData() {
  const now = new Date();
  
  try {
    // 1. Delete expired sessions (already handled by TTL index, but manual cleanup is faster)
    const deletedSessions = await Session.deleteMany({
      expiresAt: { $lt: now }
    });
    
    // 2. Delete expired blacklisted tokens (TTL index handles this, but manual is cleaner)
    const deletedBlacklist = await TokenBlacklist.deleteMany({
      expiresAt: { $lt: now }
    });
    
    // 3. Delete old security logs (keep only last 90 days for low/medium severity)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const deletedLogs = await SecurityLog.deleteMany({
      timestamp: { $lt: ninetyDaysAgo },
      severity: { $in: ['low', 'medium'] } // Keep high/critical logs longer
    });
    
    console.log('[Cleanup] Expired data removed:', {
      sessions: deletedSessions.deletedCount,
      blacklist: deletedBlacklist.deletedCount,
      logs: deletedLogs.deletedCount
    });
    
    return {
      sessions: deletedSessions.deletedCount || 0,
      blacklist: deletedBlacklist.deletedCount || 0,
      logs: deletedLogs.deletedCount || 0
    };
  } catch (error) {
    console.error('[Cleanup] Failed to clean expired data:', error);
    throw error;
  }
}

/**
 * Clean up inactive sessions older than specified days
 */
export async function cleanupInactiveSessions(daysInactive: number = 30) {
  const cutoffDate = new Date(Date.now() - daysInactive * 24 * 60 * 60 * 1000);
  
  try {
    const result = await Session.updateMany(
      {
        isActive: true,
        lastActivity: { $lt: cutoffDate }
      },
      {
        $set: {
          isActive: false,
          revokedAt: new Date(),
          revokedReason: 'Inactive session cleanup'
        }
      }
    );
    
    console.log(`[Cleanup] Deactivated ${result.modifiedCount} inactive sessions`);
    return result.modifiedCount || 0;
  } catch (error) {
    console.error('[Cleanup] Failed to clean inactive sessions:', error);
    throw error;
  }
}
