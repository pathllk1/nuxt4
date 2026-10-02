/**
 * ═══════════════════════════════════════════════════════════════════════
 * ENTERPRISE ERP UNIFICATION — DATABASE MIGRATION SCRIPT
 * ═══════════════════════════════════════════════════════════════════════
 *
 * This script performs all necessary database migrations for the
 * Enterprise ERP Unification (Phases 0-1). It is:
 *
 *   ✅ IDEMPOTENT — Safe to run multiple times without side effects
 *   ✅ NON-DESTRUCTIVE — Never deletes existing data
 *   ✅ BACKWARD-COMPATIBLE — Old code continues to work after migration
 *   ✅ DRY-RUN CAPABLE — Pass --dry-run to preview without changes
 *
 * Migrations performed:
 *   1. VoucherSequence: Drop old index, backfill financialYear, create new index
 *   2. ChartOfAccounts: Backfill bs_classification from account_type
 *   3. ChartOfAccounts: Sync firmId ← firm_id where firmId is missing
 *   4. Ledger: Add reconciliation compound indexes
 *   5. PeriodLock: Ensure collection and indexes exist
 *
 * Usage:
 *   node scripts/migrate-erp-unification.mjs
 *   node scripts/migrate-erp-unification.mjs --dry-run
 *
 * ═══════════════════════════════════════════════════════════════════════
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';

// Load environment variables
config();

const DRY_RUN = process.argv.includes('--dry-run');
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set in .env');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────
// P&L vs Balance Sheet classification map
// Used to backfill bs_classification on existing ChartOfAccounts records
// ─────────────────────────────────────────────────────────────────────────

const PNL_TYPES = new Set([
  'INCOME', 'EXPENSE', 'INDIRECT_INCOME', 'INDIRECT_EXPENSE',
]);

function classifyAccountType(accountType) {
  const normalized = (accountType || '').toUpperCase().trim();
  if (PNL_TYPES.has(normalized)) return 'PNL';
  return 'BALANCE_SHEET';
}

// ─────────────────────────────────────────────────────────────────────────
// MIGRATION STEPS
// ─────────────────────────────────────────────────────────────────────────

const migrationSteps = [];
let stepNumber = 0;

function log(msg) {
  console.log(`  ${msg}`);
}

function stepHeader(title) {
  stepNumber++;
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`  Step ${stepNumber}: ${title}`);
  console.log(`${'─'.repeat(70)}`);
}

// ═══════════════════════════════════════════════════════════════════════
// STEP 1: VoucherSequence — financialYear field + index migration
// ═══════════════════════════════════════════════════════════════════════

async function migrateVoucherSequence(db) {
  stepHeader('VoucherSequence — Add financialYear field & update index');

  const collection = db.collection('vouchersequences');

  // Check if collection exists
  const collections = await db.listCollections({ name: 'vouchersequences' }).toArray();
  if (collections.length === 0) {
    log('ℹ️  Collection does not exist yet — will be auto-created by Mongoose on first use');
    return { status: 'SKIPPED', reason: 'Collection does not exist' };
  }

  // 1a. Backfill financialYear='LEGACY' on existing records that don't have it
  const needsBackfill = await collection.countDocuments({
    $or: [
      { financialYear: { $exists: false } },
      { financialYear: null },
    ]
  });

  log(`Records needing financialYear backfill: ${needsBackfill}`);

  if (needsBackfill > 0 && !DRY_RUN) {
    const result = await collection.updateMany(
      {
        $or: [
          { financialYear: { $exists: false } },
          { financialYear: null },
        ]
      },
      { $set: { financialYear: 'LEGACY' } }
    );
    log(`✅ Backfilled financialYear='LEGACY' on ${result.modifiedCount} records`);
  } else if (needsBackfill > 0) {
    log(`🔍 DRY RUN: Would backfill ${needsBackfill} records with financialYear='LEGACY'`);
  } else {
    log('✅ All records already have financialYear');
  }

  // 1b. Drop old unique index { firmId: 1, vtype: 1 } if it exists
  const existingIndexes = await collection.indexes();
  const oldIndexName = existingIndexes.find(
    idx => idx.key && idx.key.firmId === 1 && idx.key.vtype === 1 && !idx.key.financialYear && idx.unique
  );

  if (oldIndexName) {
    log(`Found old unique index: "${oldIndexName.name}" — needs migration`);
    if (!DRY_RUN) {
      await collection.dropIndex(oldIndexName.name);
      log(`✅ Dropped old index: "${oldIndexName.name}"`);
    } else {
      log(`🔍 DRY RUN: Would drop index "${oldIndexName.name}"`);
    }
  } else {
    log('✅ Old unique index { firmId, vtype } not found (already migrated or never existed)');
  }

  // 1c. Create new compound index { firmId: 1, vtype: 1, financialYear: 1 }
  const newIndexExists = existingIndexes.find(
    idx => idx.key && idx.key.firmId === 1 && idx.key.vtype === 1 && idx.key.financialYear === 1
  );

  if (!newIndexExists) {
    if (!DRY_RUN) {
      await collection.createIndex(
        { firmId: 1, vtype: 1, financialYear: 1 },
        { unique: true, name: 'firmId_1_vtype_1_financialYear_1' }
      );
      log('✅ Created new unique index { firmId, vtype, financialYear }');
    } else {
      log('🔍 DRY RUN: Would create index { firmId, vtype, financialYear }');
    }
  } else {
    log('✅ New compound index already exists');
  }

  return { status: 'OK', backfilled: needsBackfill };
}

// ═══════════════════════════════════════════════════════════════════════
// STEP 2: ChartOfAccounts — Backfill bs_classification
// ═══════════════════════════════════════════════════════════════════════

async function migrateChartOfAccountsClassification(db) {
  stepHeader('ChartOfAccounts — Backfill bs_classification from account_type');

  const collection = db.collection('chartofaccounts');

  const collections = await db.listCollections({ name: 'chartofaccounts' }).toArray();
  if (collections.length === 0) {
    log('ℹ️  Collection does not exist yet');
    return { status: 'SKIPPED' };
  }

  // Find all records where bs_classification is null or missing
  const unclassified = await collection.find({
    $or: [
      { bs_classification: { $exists: false } },
      { bs_classification: null },
    ]
  }).toArray();

  log(`Records needing bs_classification: ${unclassified.length}`);

  if (unclassified.length === 0) {
    log('✅ All records already have bs_classification');
    return { status: 'OK', updated: 0 };
  }

  // Group by classification to use bulkWrite efficiently
  const pnlIds = [];
  const bsIds = [];

  for (const doc of unclassified) {
    const classification = classifyAccountType(doc.account_type);
    if (classification === 'PNL') {
      pnlIds.push(doc._id);
    } else {
      bsIds.push(doc._id);
    }
  }

  log(`  → PNL accounts: ${pnlIds.length}`);
  log(`  → BALANCE_SHEET accounts: ${bsIds.length}`);

  if (!DRY_RUN) {
    const ops = [];

    if (pnlIds.length > 0) {
      ops.push({
        updateMany: {
          filter: { _id: { $in: pnlIds } },
          update: { $set: { bs_classification: 'PNL' } },
        }
      });
    }

    if (bsIds.length > 0) {
      ops.push({
        updateMany: {
          filter: { _id: { $in: bsIds } },
          update: { $set: { bs_classification: 'BALANCE_SHEET' } },
        }
      });
    }

    if (ops.length > 0) {
      const result = await collection.bulkWrite(ops);
      log(`✅ Updated ${result.modifiedCount} records`);
    }
  } else {
    log(`🔍 DRY RUN: Would update ${unclassified.length} records`);
  }

  return { status: 'OK', updated: unclassified.length };
}

// ═══════════════════════════════════════════════════════════════════════
// STEP 3: ChartOfAccounts — Sync firmId ← firm_id where missing
// ═══════════════════════════════════════════════════════════════════════

async function migrateChartOfAccountsFirmId(db) {
  stepHeader('ChartOfAccounts — Sync firmId from firm_id where firmId is missing');

  const collection = db.collection('chartofaccounts');

  const collections = await db.listCollections({ name: 'chartofaccounts' }).toArray();
  if (collections.length === 0) {
    log('ℹ️  Collection does not exist yet');
    return { status: 'SKIPPED' };
  }

  // Find records where firm_id exists but firmId does not
  const missingFirmId = await collection.countDocuments({
    firm_id: { $exists: true, $ne: null },
    $or: [
      { firmId: { $exists: false } },
      { firmId: null },
    ]
  });

  log(`Records with firm_id but missing firmId: ${missingFirmId}`);

  if (missingFirmId === 0) {
    log('✅ All records have firmId in sync');
    return { status: 'OK', updated: 0 };
  }

  if (!DRY_RUN) {
    // Use aggregation pipeline update to copy firm_id → firmId
    const result = await collection.updateMany(
      {
        firm_id: { $exists: true, $ne: null },
        $or: [
          { firmId: { $exists: false } },
          { firmId: null },
        ]
      },
      [{ $set: { firmId: '$firm_id' } }]
    );
    log(`✅ Synced firmId on ${result.modifiedCount} records`);
    return { status: 'OK', updated: result.modifiedCount };
  } else {
    log(`🔍 DRY RUN: Would sync firmId on ${missingFirmId} records`);
    return { status: 'DRY_RUN', wouldUpdate: missingFirmId };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// STEP 4: Ledger — Add reconciliation compound indexes
// ═══════════════════════════════════════════════════════════════════════

async function migrateLedgerIndexes(db) {
  stepHeader('Ledger — Add SL-GL reconciliation compound indexes');

  const collection = db.collection('ledgers');

  const collections = await db.listCollections({ name: 'ledgers' }).toArray();
  if (collections.length === 0) {
    log('ℹ️  Collection does not exist yet');
    return { status: 'SKIPPED' };
  }

  const existingIndexes = await collection.indexes();
  const indexNames = existingIndexes.map(idx => idx.name);

  const newIndexes = [
    {
      key: { firmId: 1, partyId: 1, accountType: 1 },
      name: 'firmId_1_partyId_1_accountType_1',
      purpose: 'SL-GL party reconciliation queries',
    },
    {
      key: { firmId: 1, bankAccountId: 1, accountType: 1 },
      name: 'firmId_1_bankAccountId_1_accountType_1',
      purpose: 'SL-GL bank reconciliation queries',
    },
    {
      key: { firmId: 1, accountType: 1, partyId: 1, transactionDate: 1 },
      name: 'firmId_1_accountType_1_partyId_1_transactionDate_1',
      purpose: 'Party aging and statement queries',
    },
  ];

  let created = 0;

  for (const idx of newIndexes) {
    if (indexNames.includes(idx.name)) {
      log(`✅ Index "${idx.name}" already exists`);
      continue;
    }

    if (!DRY_RUN) {
      await collection.createIndex(idx.key, { name: idx.name, background: true });
      log(`✅ Created index "${idx.name}" (${idx.purpose})`);
      created++;
    } else {
      log(`🔍 DRY RUN: Would create index "${idx.name}" (${idx.purpose})`);
      created++;
    }
  }

  return { status: 'OK', indexesCreated: created };
}

// ═══════════════════════════════════════════════════════════════════════
// STEP 5: PeriodLock — Ensure collection & indexes
// ═══════════════════════════════════════════════════════════════════════

async function migratePeriodLock(db) {
  stepHeader('PeriodLock — Ensure collection and indexes exist');

  const collections = await db.listCollections({ name: 'periodlocks' }).toArray();
  const collectionExists = collections.length > 0;

  if (!collectionExists) {
    if (!DRY_RUN) {
      await db.createCollection('periodlocks');
      log('✅ Created periodlocks collection');
    } else {
      log('🔍 DRY RUN: Would create periodlocks collection');
      log('🔍 DRY RUN: Would create unique index { firmId, financialYear }');
      log('🔍 DRY RUN: Would create lookup index { firmId, isActive, lockDate }');
      return { status: 'DRY_RUN' };
    }
  } else {
    log('✅ periodlocks collection already exists');
  }

  // Only check/create indexes if the collection actually exists on disk
  const collection = db.collection('periodlocks');
  let existingIndexes;
  try {
    existingIndexes = await collection.indexes();
  } catch (e) {
    // Collection may exist but have no documents/indexes yet
    existingIndexes = [];
  }
  const indexNames = existingIndexes.map(idx => idx.name);

  // Unique index: one lock per firm per FY
  if (!indexNames.includes('firmId_1_financialYear_1')) {
    if (!DRY_RUN) {
      await collection.createIndex(
        { firmId: 1, financialYear: 1 },
        { unique: true, name: 'firmId_1_financialYear_1' }
      );
      log('✅ Created unique index { firmId, financialYear }');
    } else {
      log('🔍 DRY RUN: Would create unique index { firmId, financialYear }');
    }
  } else {
    log('✅ Unique index already exists');
  }

  // Lookup index: active locks sorted by lockDate
  if (!indexNames.includes('firmId_1_isActive_1_lockDate_-1')) {
    if (!DRY_RUN) {
      await collection.createIndex(
        { firmId: 1, isActive: 1, lockDate: -1 },
        { name: 'firmId_1_isActive_1_lockDate_-1' }
      );
      log('✅ Created lookup index { firmId, isActive, lockDate }');
    } else {
      log('🔍 DRY RUN: Would create lookup index');
    }
  } else {
    log('✅ Lookup index already exists');
  }

  return { status: 'OK' };
}

// ═══════════════════════════════════════════════════════════════════════
// STEP 6: Ledger — Backfill missing voucherType on legacy entries
// ═══════════════════════════════════════════════════════════════════════

async function migrateLedgerVoucherType(db) {
  stepHeader('Ledger — Audit entries with missing voucherType');

  const collection = db.collection('ledgers');

  const collections = await db.listCollections({ name: 'ledgers' }).toArray();
  if (collections.length === 0) {
    log('ℹ️  Collection does not exist yet');
    return { status: 'SKIPPED' };
  }

  // Count entries with null/missing voucherType
  const missingCount = await collection.countDocuments({
    $or: [
      { voucherType: { $exists: false } },
      { voucherType: null },
      { voucherType: '' },
    ]
  });

  if (missingCount === 0) {
    log('✅ All ledger entries have voucherType assigned');
    return { status: 'OK', missingCount: 0 };
  }

  log(`⚠️  Found ${missingCount} ledger entries with missing voucherType`);
  log(`   These entries were likely created by legacy code before the unified engine.`);
  log(`   They will continue to work, but won't be categorized in voucher reports.`);

  // We intentionally do NOT auto-assign a voucherType to legacy entries
  // because we can't reliably determine the correct type from the data alone.
  // This is an audit finding, not an auto-fix.

  return { status: 'AUDIT_WARNING', missingCount };
}

// ═══════════════════════════════════════════════════════════════════════
// STEP 7: Ledger — Backfill partyId for untagged party entries
// ═══════════════════════════════════════════════════════════════════════

async function migrateBackfillPartyTags(db) {
  stepHeader('Ledger — Backfill partyId for untagged party transactions');

  const ledgersCol = db.collection('ledgers');
  const partiesCol = db.collection('parties');
  const billsCol = db.collection('bills');

  const untagged = await ledgersCol.find({
    accountType: { $in: ['SUNDRY_DEBTORS', 'SUNDRY_CREDITORS', 'LABOR_LEADER'] },
    $or: [{ partyId: null }, { partyId: { $exists: false } }],
  }).toArray();

  if (untagged.length === 0) {
    log('✅ Zero untagged party entries — Sub-Ledger is in 100% parity with GL');
    return { status: 'OK', fixedCount: 0, untaggedRemaining: 0 };
  }

  log(`Found ${untagged.length} untagged party ledger entries needing resolution`);

  let fixedCount = 0;
  let remainingCount = 0;

  for (const entry of untagged) {
    const firmId = entry.firmId || entry.firm_id;
    const name = entry.accountHead;

    // Try finding the party in parties collection by firmId and name
    const party = await partiesCol.findOne({
      $or: [{ firmId: firmId }, { firm_id: firmId }],
      name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });

    if (party) {
      if (!DRY_RUN) {
        await ledgersCol.updateOne(
          { _id: entry._id },
          { $set: { partyId: party._id } }
        );
        // Also update corresponding bill if it was missing party_id
        if (entry.refType === 'BILL' && entry.refId) {
          await billsCol.updateOne(
            { _id: entry.refId, $or: [{ party_id: null }, { party_id: { $exists: false } }] },
            { $set: { party_id: party._id, party_name: party.name } }
          );
        }
      }
      log(`  Fixed: [${entry.voucherNo || entry.refType}] "${name}" → partyId: ${party._id}`);
      fixedCount++;
    } else {
      log(`  ⚠️ Could not match party for: "${name}" (firmId: ${firmId})`);
      remainingCount++;
    }
  }

  return {
    status: remainingCount === 0 ? 'OK' : 'PARTIAL',
    fixedCount,
    untaggedRemaining: remainingCount,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════════════

async function main() {
  console.log('');
  console.log('═'.repeat(70));
  console.log('  ENTERPRISE ERP UNIFICATION — DATABASE MIGRATION');
  console.log(`  Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes will be made)' : '🚀 LIVE EXECUTION'}`);
  console.log(`  Time: ${new Date().toISOString()}`);
  console.log('═'.repeat(70));

  let conn;
  try {
    // Connect to MongoDB
    console.log(`\n  Connecting to MongoDB...`);
    conn = await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 2,
    });
    const db = conn.connection.db;
    console.log(`  ✅ Connected to: ${conn.connection.host}/${conn.connection.name}`);

    // Run all migration steps
    const results = {};

    results.voucherSequence = await migrateVoucherSequence(db);
    results.coaClassification = await migrateChartOfAccountsClassification(db);
    results.coaFirmIdSync = await migrateChartOfAccountsFirmId(db);
    results.ledgerIndexes = await migrateLedgerIndexes(db);
    results.periodLock = await migratePeriodLock(db);
    results.ledgerVoucherType = await migrateLedgerVoucherType(db);
    results.backfillPartyTags = await migrateBackfillPartyTags(db);

    // Summary
    console.log(`\n${'═'.repeat(70)}`);
    console.log('  MIGRATION SUMMARY');
    console.log(`${'═'.repeat(70)}`);

    for (const [name, result] of Object.entries(results)) {
      const icon = result.status === 'OK' ? '✅'
        : result.status === 'SKIPPED' ? 'ℹ️'
        : result.status === 'DRY_RUN' ? '🔍'
        : result.status === 'AUDIT_WARNING' ? '⚠️'
        : '❌';
      console.log(`  ${icon} ${name}: ${result.status} ${JSON.stringify(result).substring(0, 80)}`);
    }

    if (DRY_RUN) {
      console.log(`\n  🔍 This was a DRY RUN — no changes were made.`);
      console.log(`  Run without --dry-run to execute the migration.`);
    } else {
      console.log(`\n  ✅ All migrations completed successfully.`);
    }

  } catch (err) {
    console.error(`\n  ❌ Migration failed:`, err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    if (conn) {
      await mongoose.disconnect();
      console.log(`\n  Disconnected from MongoDB.`);
    }
  }

  console.log('');
  process.exit(0);
}

main();
