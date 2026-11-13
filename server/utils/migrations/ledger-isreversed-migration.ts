import mongoose from 'mongoose';

export interface IMigrationResult {
  migrationId: string;
  status: 'COMPLETED' | 'ALREADY_COMPLETED' | 'BLOCKED_CONFLICT' | 'FAILED';
  updatedCount?: number;
  conflicts?: any[];
  error?: string;
}

/**
 * Versioned Migration: v2026_11_13_ledger_isreversed_backfill
 *
 * Safely migrates legacy ledger documents with missing/null `isReversed`
 * to `isReversed: false` so they become members of the unique partial index
 * on (firmId, voucherGroupId, legIndex).
 *
 * Guarantees:
 * 1. Preflight Duplicate Detection: Identifies any existing duplicate keys that
 *    would cause partial index violations. Blocks and reports conflicts.
 * 2. Controlled Execution: Backfills legacy rows only after duplicate verification.
 * 3. Post-Migration Parity Check: Asserts 0 remaining null/missing rows.
 * 4. Idempotent Status Registry: Records success/failure state in `system_migrations`.
 */
export async function runLedgerIsReversedMigration(): Promise<IMigrationResult> {
  const migrationId = 'v2026_11_13_ledger_isreversed_backfill';
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection not established.');
  }

  const migrationsCol = db.collection('system_migrations');
  const ledgerCol = db.collection('ledgers');

  // Check if migration has already succeeded
  const existingMigration = await migrationsCol.findOne({ migrationId, status: 'COMPLETED' });
  if (existingMigration) {
    return { migrationId, status: 'ALREADY_COMPLETED' };
  }

  // ── Step 1: Preflight Duplicate Key Verification (F-07) ──
  // Check for any legacy duplicate keys across rows that would join the partial unique index:
  // (firmId, voucherGroupId, legIndex) where isReversed is null/false
  const duplicateGroups = await ledgerCol.aggregate([
    {
      $match: {
        isReversed: { $ne: true },
        voucherGroupId: { $type: 'string' }
      }
    },
    {
      $group: {
        _id: {
          firmId: { $ifNull: ['$firmId', '$firm_id'] },
          voucherGroupId: '$voucherGroupId',
          legIndex: { $ifNull: ['$legIndex', 0] }
        },
        count: { $sum: 1 },
        docIds: { $push: '$_id' }
      }
    },
    {
      $match: {
        count: { $gt: 1 }
      }
    }
  ]).toArray();

  if (duplicateGroups.length > 0) {
    const conflictSummary = duplicateGroups.slice(0, 10).map(g => ({
      key: g._id,
      duplicateCount: g.count,
      sampleDocIds: g.docIds.slice(0, 3)
    }));

    await migrationsCol.updateOne(
      { migrationId },
      {
        $set: {
          migrationId,
          status: 'BLOCKED_CONFLICT',
          conflictCount: duplicateGroups.length,
          sampleConflicts: conflictSummary,
          attemptedAt: new Date()
        }
      },
      { upsert: true }
    );

    const conflictErr = new Error(
      `[Migration Blocked] Duplicate keys detected on (firmId, voucherGroupId, legIndex) across ${duplicateGroups.length} groups. Backfill cannot safely proceed without violating unique partial index. Resolve duplicates before applying migration.`
    );
    (conflictErr as any).conflicts = conflictSummary;
    throw conflictErr;
  }

  // ── Step 2: Safe Backfill of Legacy Rows (F-07) ──
  const updateResult = await ledgerCol.updateMany(
    {
      $or: [
        { isReversed: { $in: [null, undefined] } },
        { isReversed: { $exists: false } }
      ]
    },
    { $set: { isReversed: false } }
  );

  // ── Step 3: Post-Migration Parity Verification (F-07) ──
  const remainingCount = await ledgerCol.countDocuments({
    $or: [
      { isReversed: { $in: [null, undefined] } },
      { isReversed: { $exists: false } }
    ]
  });

  if (remainingCount > 0) {
    throw new Error(
      `[Migration Verification Failed] ${remainingCount} legacy ledger rows remain unmigrated with missing/null isReversed.`
    );
  }

  // ── Step 4: Record Completed Migration ──
  await migrationsCol.updateOne(
    { migrationId },
    {
      $set: {
        migrationId,
        status: 'COMPLETED',
        updatedCount: updateResult.modifiedCount,
        completedAt: new Date()
      }
    },
    { upsert: true }
  );

  console.log(`✅ [Migration] ${migrationId} successfully applied. ${updateResult.modifiedCount} legacy ledger rows backfilled.`);

  return {
    migrationId,
    status: 'COMPLETED',
    updatedCount: updateResult.modifiedCount
  };
}

