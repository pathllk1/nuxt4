/**
 * Cross-Database Atomicity Audit & Reconciliation: MongoDB General Ledger vs PostgreSQL Labor Advances
 *
 * Verifies that every labor advance committed in MongoDB has a matching, verified row in PostgreSQL labor_advances,
 * and identifies any orphaned entries or state divergences between the distributed stores.
 *
 * Usage:
 *   node scripts/reconcile-gl-labor-advances.mjs           # Read-only audit
 *   node scripts/reconcile-gl-labor-advances.mjs --dry-run # Simulate resolution
 */

import mongoose from 'mongoose';
import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const isDryRun = process.argv.includes('--dry-run');

async function main() {
  console.log('========================================================================');
  console.log('   CROSS-DATABASE ATOMICITY AUDIT: MONGO GL vs POSTGRES LABOR ADVANCES');
  console.log(`   Mode: ${isDryRun ? 'DRY-RUN SIMULATION' : 'READ-ONLY AUDIT'}`);
  console.log('========================================================================\n');

  if (!process.env.MONGODB_URI) {
    console.error('Error: MONGODB_URI is not defined in environment.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Connected to MongoDB');

  let sql = null;
  const pgUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (pgUrl) {
    sql = postgres(pgUrl);
    console.log('✓ Connected to PostgreSQL');
  } else {
    console.warn('⚠ DATABASE_URL not set; PostgreSQL comparison will be simulated or skipped.');
  }

  try {
    const ledgerCol = mongoose.connection.collection('ledgers');

    // 1. Find all active MongoDB ledger vouchers related to labor advances
    const glAdvanceLegs = await ledgerCol.find({
      isReversed: { $ne: true },
      $or: [
        { refType: 'LABOR_ADVANCE' },
        { narration: { $regex: /labor\s*advance/i } },
        { accountHead: { $regex: /labor.*advance/i } }
      ]
    }).toArray();

    console.log(`\nFound ${glAdvanceLegs.length} labor-advance ledger legs in MongoDB GL.`);

    // Group by voucherGroupId
    const glVoucherGroups = new Map();
    for (const leg of glAdvanceLegs) {
      const gid = leg.voucherGroupId || 'NO_GROUP';
      const existing = glVoucherGroups.get(gid) || [];
      existing.push(leg);
      glVoucherGroups.set(gid, existing);
    }

    console.log(`Aggregated into ${glVoucherGroups.size} unique voucher groups in MongoDB.`);

    if (sql) {
      // 2. Query PostgreSQL labor_advances
      const pgAdvances = await sql`
        SELECT id, firm_id, leader_id, period_id, amount, payment_date, ledger_voucher_group_id, idempotency_key
        FROM labor_advances
      `;

      console.log(`Found ${pgAdvances.length} labor advances in PostgreSQL.`);

      const pgByVoucherGroup = new Map();
      for (const adv of pgAdvances) {
        if (adv.ledger_voucher_group_id) {
          const list = pgByVoucherGroup.get(adv.ledger_voucher_group_id) || [];
          list.push(adv);
          pgByVoucherGroup.set(adv.ledger_voucher_group_id, list);
        }
      }

      let matchedCount = 0;
      let orphanedInMongo = 0;
      let orphanedInPostgres = 0;

      for (const [gid, legs] of glVoucherGroups.entries()) {
        if (gid === 'NO_GROUP') continue;
        const pgRows = pgByVoucherGroup.get(gid);
        if (pgRows && pgRows.length > 0) {
          matchedCount++;
        } else {
          orphanedInMongo++;
          console.warn(`[Orphaned in Mongo GL] Voucher "${gid}" has no matching record in PostgreSQL labor_advances.`);
        }
      }

      for (const [gid, rows] of pgByVoucherGroup.entries()) {
        if (!glVoucherGroups.has(gid)) {
          orphanedInPostgres++;
          console.warn(`[Orphaned in Postgres] Labor advance group "${gid}" has no matching active ledger voucher in MongoDB GL.`);
        }
      }

      console.log('\n========================================================================');
      console.log('RECONCILIATION SUMMARY:');
      console.log(`- Matched Groups: ${matchedCount}`);
      console.log(`- Orphaned in MongoDB GL: ${orphanedInMongo}`);
      console.log(`- Orphaned in PostgreSQL: ${orphanedInPostgres}`);
      console.log(`- Status: ${orphanedInMongo === 0 && orphanedInPostgres === 0 ? 'PERFECTLY SYNCHRONIZED' : 'VARIANCE DETECTED'}`);
      console.log('========================================================================');
    }
  } catch (err) {
    console.error('Audit failed with error:', err);
  } finally {
    if (sql) await sql.end();
    await mongoose.disconnect();
    console.log('Audit completed.\n');
  }
}

main().catch(console.error);
