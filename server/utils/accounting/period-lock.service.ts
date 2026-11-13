import mongoose from 'mongoose';
import PeriodLock from '../../models/PeriodLock';
import PostingBarrier from '../../models/PostingBarrier';

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

  // Find all active locks for this firm where the lock date >= transaction date,
  // or where the financial year is actively closing or closed (F-01)
  const fy = getFinancialYearFromDate(transactionDate);
  const activeLock = await PeriodLock.findOne(
    {
      firmId: firmIdObj,
      $or: [
        { isActive: true, lockDate: { $gte: transactionDate } },
        { financialYear: fy, closingStatus: { $in: ['IN_PROGRESS', 'CLOSED'] } }
      ]
    },
    'lockDate financialYear reason lockedBy closingStatus',
    { session: session || undefined }
  ).lean();

  if (activeLock) {
    const error: any = new Error(
      `Transaction date ${transactionDate} falls within locked fiscal period ` +
      `(Locked up to ${activeLock.lockDate}, FY ${activeLock.financialYear}). ` +
      `Closing status: ${activeLock.closingStatus || 'LOCKED'}. ` +
      `Reason: ${activeLock.reason || 'Period closed'}. ` +
      `Request admin unlock override if this entry is necessary.`
    );
    error.statusCode = 403;
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// In-Flight Posting Barrier & Writer Fencing (F-01)
//
// Tracks active in-flight posting transactions per (firmId, financialYear).
// Close workers wait for in-flight postings to drain before taking the
// trial-balance snapshot, and posting transactions verify the period lock
// barrier immediately before commit to prevent races.
// ─────────────────────────────────────────────────────────────────────────

const inFlightPostings = new Map<string, Set<string>>();

export function getFinancialYearFromDate(dateStr: string): string {
  const parts = dateStr.split('-');
  const year = parseInt(parts[0]!, 10);
  const month = parseInt(parts[1]!, 10);
  const startYear = month >= 4 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

export interface IPostingBarrierToken {
  postingId: string;
  firmId: string;
  financialYear: string;
  release: () => void;
}

/**
 * Acquires a posting barrier ticket before starting a ledger write operation.
 * Fails closed if the period is locked or closing is in progress.
 * Backed by both local registry and distributed MongoDB PostingBarrier documents (F-01).
 */
export async function acquirePostingBarrier(
  firmId: mongoose.Types.ObjectId | string,
  transactionDate: string,
  session?: mongoose.ClientSession | null
): Promise<IPostingBarrierToken> {
  const firmIdStr = String(firmId);
  const fy = getFinancialYearFromDate(transactionDate);

  // 1. Initial lock check
  await enforcePeriodLock(firmId, transactionDate, session);

  // 2. Register in-flight writer ticket locally and in distributed collection (F-01)
  const key = `${firmIdStr}:${fy}`;
  const postingId = new mongoose.Types.ObjectId().toString();
  if (!inFlightPostings.has(key)) {
    inFlightPostings.set(key, new Set());
  }
  inFlightPostings.get(key)!.add(postingId);

  // Distributed registration in MongoDB (independent of caller's transaction session)
  // F-01: Fail-closed. Throw error if distributed barrier ticket registration cannot be confirmed.
  let renewalTimer: any = null;
  if (mongoose.connection.readyState === 1) {
    try {
      await PostingBarrier.create([{
        firmId: firmIdStr,
        financialYear: fy,
        postingId,
        expiresAt: new Date(Date.now() + 60000)
      }]);
    } catch (e: any) {
      // Remove from local memory before rethrowing
      inFlightPostings.get(key)?.delete(postingId);
      throw new Error(`[PeriodLock - F-01] Critical: Failed to register distributed barrier ticket: ${e?.message}`);
    }

    // Renewable ownership tied to transaction lifecycle (prevents premature 60s TTL expiration)
    renewalTimer = setInterval(async () => {
      try {
        if (!released) {
          await PostingBarrier.updateOne(
            { postingId },
            { $set: { expiresAt: new Date(Date.now() + 60000) } }
          );
        }
      } catch (_) {}
    }, 15000);
    if (typeof renewalTimer.unref === 'function') renewalTimer.unref();
  }

  let released = false;
  return {
    postingId,
    firmId: firmIdStr,
    financialYear: fy,
    release: () => {
      if (!released) {
        released = true;
        if (renewalTimer) {
          clearInterval(renewalTimer);
          renewalTimer = null;
        }
        const set = inFlightPostings.get(key);
        if (set) {
          set.delete(postingId);
          if (set.size === 0) inFlightPostings.delete(key);
        }
        if (mongoose.connection.readyState === 1) {
          PostingBarrier.deleteOne({ postingId }).catch(() => {});
        }
      }
    }
  };
}

/**
 * Re-validates the period lock barrier immediately before write/commit.
 * Uses a fresh read outside the caller's transaction snapshot to ensure
 * a close worker hasn't acquired the lock while the posting was in flight (F-01).
 */
export async function verifyPostingBarrier(
  firmId: mongoose.Types.ObjectId | string,
  transactionDate: string
): Promise<void> {
  // Always query directly without session to see the latest committed close lock state
  await enforcePeriodLock(firmId, transactionDate, null);
}

/**
 * Called by fiscal-year-closing.service.ts to ensure all in-flight posting
 * transactions have drained before the trial-balance snapshot is calculated (F-01).
 * Fails closed by throwing an error if in-flight postings do not drain within timeout.
 */
export async function drainInFlightPostings(
  firmId: mongoose.Types.ObjectId | string,
  financialYear: string,
  timeoutMs: number = 5000
): Promise<void> {
  const firmIdStr = String(firmId);
  const key = `${firmIdStr}:${financialYear}`;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const localCount = inFlightPostings.get(key)?.size || 0;
    let distributedCount = 0;
    if (mongoose.connection.readyState === 1) {
      distributedCount = await PostingBarrier.countDocuments({
        firmId: firmIdStr,
        financialYear,
        expiresAt: { $gt: new Date() }
      });
    }
    if (localCount === 0 && distributedCount === 0) {
      return; // Drained successfully
    }
    await new Promise((r) => setTimeout(r, 50));
  }

  const remainingLocal = inFlightPostings.get(key)?.size || 0;
  let remainingDistributed = 0;
  if (mongoose.connection.readyState === 1) {
    remainingDistributed = await PostingBarrier.countDocuments({
      firmId: firmIdStr,
      financialYear,
      expiresAt: { $gt: new Date() }
    });
  }

  const totalRemaining = Math.max(remainingLocal, remainingDistributed);
  if (totalRemaining > 0) {
    throw new Error(
      `[PeriodLock] ${totalRemaining} in-flight posting transactions did not drain within ${timeoutMs}ms for FY ${financialYear}. ` +
      `Year-end close snapshot aborted to prevent uncommitted or racing writes from entering the closed financial year.`
    );
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
