import mongoose from 'mongoose';
import PeriodLock from '../../models/PeriodLock';

// ─────────────────────────────────────────────────────────────────────────
// Period Lock Service
//
// Provides the guard function that the UnifiedPostingService calls before
// every write operation. If the transaction date falls within a locked
// period, the posting is rejected with a 403 error.
//
// CAUTION: This service is a critical compliance gate. Modifications
// must be reviewed carefully — bypassing period lock can lead to
// statutory non-compliance (GST returns, audit freeze, etc.)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Checks whether the given transactionDate is within a locked fiscal period.
 * Throws a 403-equivalent error if the date is frozen.
 *
 * @param firmId - The firm to check period locks for
 * @param transactionDate - The date to validate (YYYY-MM-DD)
 * @param session - Optional MongoDB session for transactional reads
 * @throws Error if the transaction date is within a locked period
 */
export async function enforcePeriodLock(
  firmId: mongoose.Types.ObjectId | string,
  transactionDate: string,
  session?: mongoose.ClientSession | null
): Promise<void> {
  if (!transactionDate) return; // No date to check — should be caught upstream

  const firmIdObj = new mongoose.Types.ObjectId(String(firmId));

  // Find all active locks for this firm where the lock date >= transaction date.
  // If any exist, the transaction date is within a locked period.
  const activeLock = await PeriodLock.findOne(
    {
      firmId: firmIdObj,
      isActive: true,
      lockDate: { $gte: transactionDate },
    },
    'lockDate financialYear reason lockedBy',
    { session: session || undefined }
  ).lean();

  if (activeLock) {
    const error: any = new Error(
      `Transaction date ${transactionDate} falls within locked fiscal period ` +
      `(Locked up to ${activeLock.lockDate}, FY ${activeLock.financialYear}). ` +
      `Reason: ${activeLock.reason || 'Period closed'}. ` +
      `Request admin unlock override if this entry is necessary.`
    );
    error.statusCode = 403;
    throw error;
  }
}

/**
 * Checks whether the given transactionDate is within a locked fiscal period.
 * Returns true if locked, false if open. Does not throw an error.
 */
export async function isPeriodLocked(
  firmId: mongoose.Types.ObjectId | string,
  transactionDate: string,
  session?: mongoose.ClientSession | null
): Promise<boolean> {
  if (!transactionDate) return false;
  const firmIdObj = new mongoose.Types.ObjectId(String(firmId));
  const activeLock = await PeriodLock.findOne(
    {
      firmId: firmIdObj,
      isActive: true,
      lockDate: { $gte: transactionDate },
    },
    '_id',
    { session: session || undefined }
  ).lean();
  return !!activeLock;
}

/**
 * Gets the current lock status for a firm. Returns the most restrictive
 * active lock (latest lockDate).
 */
export async function getCurrentLockStatus(
  firmId: mongoose.Types.ObjectId | string
): Promise<{ isLocked: boolean; lockDate?: string; financialYear?: string; reason?: string }> {
  const firmIdObj = new mongoose.Types.ObjectId(String(firmId));

  const latestLock = await PeriodLock.findOne(
    { firmId: firmIdObj, isActive: true },
    'lockDate financialYear reason',
    { sort: { lockDate: -1 } }
  ).lean();

  if (!latestLock) {
    return { isLocked: false };
  }

  return {
    isLocked: true,
    lockDate: latestLock.lockDate,
    financialYear: latestLock.financialYear,
    reason: latestLock.reason,
  };
}

/**
 * Sets or updates the period lock for a given financial year.
 * This is an admin-only operation.
 *
 * @param params - Lock parameters
 * @returns The created or updated PeriodLock document
 */
export async function setPeriodLock(params: {
  firmId: mongoose.Types.ObjectId | string;
  lockDate: string;
  financialYear: string;
  reason: string;
  lockedBy: string;
  session?: mongoose.ClientSession;
}) {
  const { firmId, lockDate, financialYear, reason, lockedBy, session } = params;
  const firmIdObj = new mongoose.Types.ObjectId(String(firmId));

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lockDate)) {
    throw new Error(`Invalid lock date format: ${lockDate}. Expected YYYY-MM-DD.`);
  }

  const result = await PeriodLock.findOneAndUpdate(
    { firmId: firmIdObj, financialYear },
    {
      $set: {
        lockDate,
        reason,
        lockedBy,
        isActive: true,
      },
      $setOnInsert: {
        firmId: firmIdObj,
        financialYear,
        closingStatus: 'NOT_CLOSED',
      },
    },
    { upsert: true, returnDocument: 'after', session }
  );

  return result;
}

/**
 * Temporarily unlocks a period (admin override).
 * This should be used sparingly and with audit logging.
 */
export async function unlockPeriod(params: {
  firmId: mongoose.Types.ObjectId | string;
  financialYear: string;
  reason: string;
  unlockedBy: string;
  session?: mongoose.ClientSession;
}) {
  const { firmId, financialYear, reason, unlockedBy, session } = params;
  const firmIdObj = new mongoose.Types.ObjectId(String(firmId));

  const lock = await PeriodLock.findOne({
    firmId: firmIdObj,
    financialYear,
    isActive: true,
  }).session(session || null);

  if (!lock) {
    throw new Error(`No active lock found for FY ${financialYear}`);
  }

  // Safety: do not unlock a CLOSED financial year
  if (lock.closingStatus === 'CLOSED') {
    throw new Error(
      `Cannot unlock FY ${financialYear}: Year-end closing has been executed. ` +
      `Unlocking a closed year requires manual database intervention by a DBA.`
    );
  }

  lock.isActive = false;
  lock.reason = `UNLOCKED by ${unlockedBy}: ${reason} (previously: ${lock.reason})`;
  await lock.save({ session: session || undefined });

  return lock;
}
