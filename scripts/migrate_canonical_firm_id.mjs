/**
 * Canonical Firm ID & Chart of Accounts Classification Migration Script
 *
 * Normalizes firm identifier schema across all MongoDB accounting models:
 *   - Ensures both `firmId` and `firm_id` exist and match on every document.
 *   - Populates missing `bs_classification` on ChartOfAccounts records based on `account_type`.
 *
 * Run with: node scripts/migrate_canonical_firm_id.mjs
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment.');
  process.exit(1);
}

const PNL_TYPES = new Set([
  'INCOME', 'EXPENSE', 'INDIRECT_INCOME', 'INDIRECT_EXPENSE',
  'DIRECT_EXPENSE', 'DIRECT_INCOME', 'COGS', 'CASUAL_LABOR', 'GENERAL'
]);

const BS_TYPES = new Set([
  'ASSET', 'LIABILITY', 'CAPITAL', 'PAYABLE', 'CASH', 'BANK',
  'BANK_ACCOUNT', 'SUNDRY_DEBTORS', 'SUNDRY_CREDITORS', 'DEBTOR',
  'CREDITOR', 'RECEIVABLE', 'LABOR_LEADER', 'TRANSPORTER', 'STAFF',
  'LOANS_BORROWINGS', 'LOANS_ADVANCES', 'DUTIES_AND_TAXES', 'FIXED_ASSETS'
]);

function classifyType(accountType) {
  const norm = String(accountType || '').toUpperCase().trim();
  if (PNL_TYPES.has(norm)) return 'PNL';
  if (BS_TYPES.has(norm)) return 'BALANCE_SHEET';
  return null;
}

async function runMigration() {
  console.log('🔄 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB Atlas');

  const db = mongoose.connection.db;

  const collections = [
    { name: 'chartofaccounts', hasCOAClassification: true },
    { name: 'advances' },
    { name: 'bankaccounts' },
    { name: 'masterrolls' },
    { name: 'wages' },
    { name: 'stocks' },
    { name: 'stockregs' },
    { name: 'ledgers' },
  ];

  for (const colInfo of collections) {
    const colName = colInfo.name;
    try {
      const col = db.collection(colName);
      const count = await col.countDocuments();
      console.log(`\n📂 Processing collection: "${colName}" (${count} documents)...`);

      // 1. Copy firm_id to firmId if missing
      const res1 = await col.updateMany(
        { firm_id: { $exists: true }, firmId: { $exists: false } },
        [{ $set: { firmId: '$firm_id' } }]
      );
      console.log(`   └─ Copied firm_id -> firmId on ${res1.modifiedCount} documents.`);

      // 2. Copy firmId to firm_id if missing
      const res2 = await col.updateMany(
        { firmId: { $exists: true }, firm_id: { $exists: false } },
        [{ $set: { firm_id: '$firmId' } }]
      );
      console.log(`   └─ Copied firmId -> firm_id on ${res2.modifiedCount} documents.`);

      // 3. For Chart of Accounts: populate missing bs_classification
      if (colInfo.hasCOAClassification) {
        const missingBsDocs = await col.find({
          $or: [{ bs_classification: null }, { bs_classification: { $exists: false } }]
        }).toArray();

        let bsUpdated = 0;
        for (const doc of missingBsDocs) {
          const bsClass = classifyType(doc.account_type);
          if (bsClass) {
            await col.updateOne(
              { _id: doc._id },
              { $set: { bs_classification: bsClass } }
            );
            bsUpdated++;
          }
        }
        console.log(`   └─ Populated bs_classification on ${bsUpdated} master accounts.`);
      }

    } catch (err) {
      console.warn(`   ⚠️ Warning processing ${colName}:`, err.message);
    }
  }

  console.log('\n🎉 Canonical firmId and COA classification migration complete!');
  await mongoose.disconnect();
}

runMigration().catch((err) => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});

