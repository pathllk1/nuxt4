/**
 * Dual Database (MongoDB + PostgreSQL) Audit & Fix Script for TDS & Double-Entry Accounting
 *
 * Usage:
 *   node scripts/audit_and_fix_tds_double_entry.mjs           # Read-only audit
 *   node scripts/audit_and_fix_tds_double_entry.mjs --dry-run # Simulate fixes
 *   node scripts/audit_and_fix_tds_double_entry.mjs --fix     # Apply fixes with safety checks
 */

import postgres from 'postgres';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const isFixMode = process.argv.includes('--fix');
const isDryRun = process.argv.includes('--dry-run');

async function main() {
  console.log('================================================================');
  console.log('   DUAL DATABASE (MONGO + POSTGRES) TDS & GL DOUBLE-ENTRY AUDIT');
  console.log(`   Mode: ${isFixMode ? 'EXECUTE FIX' : (isDryRun ? 'DRY-RUN SIMULATION' : 'READ-ONLY AUDIT')}`);
  console.log('================================================================\n');

  console.log('1. Connecting to databases...');
  const sql = postgres(process.env.POSTGRES_URL, { ssl: { rejectUnauthorized: false } });
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Successfully connected to MongoDB & PostgreSQL.\n');

  const ledgerCol = mongoose.connection.collection('ledgers');
  const coaCol = mongoose.connection.collection('chartofaccounts');

  // Step 1: Scan all vouchers that have TDS legs or TDS mentions
  console.log('2. Scanning MongoDB Ledgers for TDS vouchers...');
  const candidateTdsLegs = await ledgerCol.find({
    $or: [
      { accountType: 'DUTIES_AND_TAXES' },
      { accountHead: { $regex: 'tds', $options: 'i' } }
    ],
    accountHead: { $not: /borne by company/i }
  }).toArray();

  const voucherGroupIds = [...new Set(candidateTdsLegs.map(l => l.voucherGroupId).filter(Boolean))];
  console.log(`Found ${candidateTdsLegs.length} candidate TDS legs across ${voucherGroupIds.length} unique vouchers.\n`);

  console.log('3. Checking Double-Entry Parity (ΣDebit === ΣCredit)...');
  let unbalancedCount = 0;
  const unbalancedVouchers = [];

  for (const vgId of voucherGroupIds) {
    const legs = await ledgerCol.find({ voucherGroupId: vgId }).toArray();
    let totalDr = 0;
    let totalCr = 0;

    for (const leg of legs) {
      totalDr += Number(leg.debitAmount || 0);
      totalCr += Number(leg.creditAmount || 0);
    }

    const diff = Math.abs(totalDr - totalCr);
    if (diff >= 0.01) {
      unbalancedCount++;
      unbalancedVouchers.push({ vgId, totalDr, totalCr, diff, legs });
      console.log(`  ❌ UNBALANCED: Voucher ${vgId} | DR: ₹${totalDr.toFixed(2)} | CR: ₹${totalCr.toFixed(2)} | Diff: ₹${diff.toFixed(2)}`);
    }
  }

  if (unbalancedCount === 0) {
    console.log(`  ✓ All ${voucherGroupIds.length} TDS vouchers in MongoDB are 100% BALANCED! (Double-entry integrity intact)\n`);
  } else {
    console.log(`  ⚠️ Warning: Found ${unbalancedCount} unbalanced vouchers.\n`);
  }

  // Step 2: Check for accountType misclassifications
  console.log('4. Checking for Account Head / Account Type misclassifications...');
  const misclassifiedBankLegs = await ledgerCol.find({
    voucherGroupId: { $in: voucherGroupIds },
    accountType: 'DUTIES_AND_TAXES',
    accountHead: { $regex: 'bank|cash|cc|current|savings', $options: 'i' }
  }).toArray();

  if (misclassifiedBankLegs.length > 0) {
    console.log(`  ⚠️ Found ${misclassifiedBankLegs.length} Bank legs mistakenly tagged as DUTIES_AND_TAXES:`);
    for (const l of misclassifiedBankLegs) {
      console.log(`    Leg ID: ${l._id} | Head: ${l.accountHead} | Voucher: ${l.voucherGroupId}`);
    }

    if (isFixMode && !isDryRun) {
      console.log('    --> Fixing accountType to "BANK"...');
      const updateRes = await ledgerCol.updateMany(
        { _id: { $in: misclassifiedBankLegs.map(l => l._id) } },
        { $set: { accountType: 'BANK', updatedAt: new Date() } }
      );
      console.log(`    ✓ Fixed ${updateRes.modifiedCount} legs.`);
    }
  } else {
    console.log('  ✓ No Bank legs misclassified as DUTIES_AND_TAXES.\n');
  }

  // Step 3: Cross-database verification with PostgreSQL labor_advances
  console.log('5. Cross-Verifying with PostgreSQL labor_advances...');
  const pgAdvances = await sql`
    SELECT id, period_id, amount, gross_amount, tds_amount, tds_mode, tds_rate, ledger_voucher_group_id, payment_date
    FROM labor_advances
    WHERE ledger_voucher_group_id IN ${sql(voucherGroupIds.length ? voucherGroupIds : ['none'])}
    ORDER BY payment_date DESC
  `;

  console.log(`Found ${pgAdvances.length} labor_advances linked to these vouchers in PostgreSQL.`);
  let syncDiscrepancies = 0;

  for (const adv of pgAdvances) {
    const mongoLegs = await ledgerCol.find({ voucherGroupId: adv.ledger_voucher_group_id }).toArray();
    
    // Find MongoDB TDS leg
    const tdsLeg = mongoLegs.find(l => 
      (l.accountType === 'DUTIES_AND_TAXES' || /tds/i.test(l.accountHead)) &&
      !/borne by company/i.test(l.accountHead) &&
      Number(l.creditAmount || 0) > 0
    );

    // Find MongoDB Bank leg
    const bankLeg = mongoLegs.find(l => 
      (l.accountType === 'BANK' || l.accountType === 'CASH' || l.bankAccountId) &&
      Number(l.creditAmount || 0) > 0
    );

    const mongoTds = Number(tdsLeg?.creditAmount || 0);
    const mongoNet = Number(bankLeg?.creditAmount || 0);

    const isTdsSynced = Math.abs(Number(adv.tds_amount || 0) - mongoTds) < 0.05;
    const isNetSynced = Math.abs(Number(adv.amount || 0) - mongoNet) < 0.05;

    if (!isTdsSynced || !isNetSynced) {
      syncDiscrepancies++;
      console.log(`  ⚠️ MISMATCH in Voucher ${adv.ledger_voucher_group_id}:`);
      console.log(`     PG:    Net ₹${Number(adv.amount).toFixed(2)}, TDS ₹${Number(adv.tds_amount).toFixed(2)}`);
      console.log(`     Mongo: Net ₹${mongoNet.toFixed(2)}, TDS ₹${mongoTds.toFixed(2)}`);

      if (isFixMode && !isDryRun && mongoNet > 0) {
        console.log(`     --> Syncing PostgreSQL from MongoDB truth...`);
        await sql`
          UPDATE labor_advances
          SET amount = ${mongoNet},
              tds_amount = ${mongoTds},
              gross_amount = ${mongoNet + mongoTds}
          WHERE id = ${adv.id}
        `;
        console.log(`     ✓ Synced PG advance ID: ${adv.id}`);
      }
    } else {
      console.log(`  ✓ Voucher ${adv.ledger_voucher_group_id.padEnd(20)}: PG & MongoDB perfectly in sync (Net: ₹${mongoNet.toFixed(2)}, TDS: ₹${mongoTds.toFixed(2)})`);
    }
  }

  console.log('\n================================================================');
  console.log('   AUDIT SUMMARY');
  console.log('================================================================');
  console.log(`Total Vouchers Audited:        ${voucherGroupIds.length}`);
  console.log(`Double-Entry Imbalances:       ${unbalancedCount}`);
  console.log(`Account Misclassifications:    ${misclassifiedBankLegs.length}`);
  console.log(`PG <-> Mongo Sync Issues:      ${syncDiscrepancies}`);
  console.log(`Overall Health Status:         ${(unbalancedCount === 0 && syncDiscrepancies === 0) ? 'HEALTHY & AUDIT-READY' : 'NEEDS ATTENTION'}`);
  console.log('================================================================\n');

  await sql.end();
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Audit Script Error:', err);
  process.exit(1);
});

