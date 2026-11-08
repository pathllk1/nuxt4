import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

const ACCOUNT_CODE_MAP = {
  CASH: '1100',
  BANK: '1200',
  BANK_ACCOUNT: '1200',
  SUNDRY_DEBTORS: '1300',
  DEBTOR: '1300',
  RECEIVABLE: '1300',
  LOANS_ADVANCES: '1400',
  EMPLOYEE_ADVANCE: '1410',
  LABOR_ADVANCE: '1420',
  SITE_IMPREST: '1430',
  FIXED_ASSETS: '1500',
  ASSET: '1500',
  SUNDRY_CREDITORS: '2100',
  CREDITOR: '2100',
  PAYABLE: '2100',
  TRANSPORTER: '2150',
  SUBCONTRACTOR_PAYABLE: '2150',
  RETENTION_PAYABLE: '2160',
  LABOR_LEADER: '2210',
  LABOR_PAYABLE: '2210',
  DUTIES_AND_TAXES: '2300',
  LIABILITY: '2300',
  STAFF: '2410',
  SALARIES_PAYABLE: '2410',
  LOANS_BORROWINGS: '2500',
  CAPITAL: '3100',
  RESERVES_SURPLUS: '3200',
  INCOME: '4100',
  DIRECT_INCOME: '4200',
  INDIRECT_INCOME: '4300',
  ROUND_OFF_GAIN: '4990',
  DIRECT_EXPENSE: '5100',
  EXPENSE: '5200',
  INDIRECT_EXPENSE: '5200',
  GENERAL: '5200',
  CASUAL_LABOR: '5210',
  COGS: '5190',
  ROUND_OFF_LOSS: '5990',
};

async function runMigration() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('No MONGODB_URI found in environment.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  console.log('--- STARTING ACCOUNTING CODE & VOUCHER TYPE BACKFILL MIGRATION ---');

  // Step 0: Pre-migration Trial Balance Parity Assertion
  const [preStats] = await db.collection('ledgers').aggregate([
    {
      $group: {
        _id: null,
        totalDr: { $sum: '$debitAmount' },
        totalCr: { $sum: '$creditAmount' },
        count: { $sum: 1 }
      }
    }
  ]).toArray();

  const preDrPaise = Math.round(preStats.totalDr * 100);
  const preCrPaise = Math.round(preStats.totalCr * 100);
  console.log(`Pre-migration Ledger: ${preStats.count} records | Total DR: ₹${(preDrPaise / 100).toFixed(2)} | Total CR: ₹${(preCrPaise / 100).toFixed(2)}`);

  // Step 1: Backfill voucherType on 1,766 legacy ledgers
  console.log('Step 1: Analyzing and updating ledgers with voucherType: null...');

  // 1A: refType == 'WAGE' -> 'JOURNAL'
  const wageRes = await db.collection('ledgers').updateMany(
    { voucherType: null, refType: 'WAGE' },
    { $set: { voucherType: 'JOURNAL' } }
  );
  console.log(`  Updated ${wageRes.modifiedCount} WAGE ledgers -> voucherType: 'JOURNAL'`);

  // 1B: refType == 'ADVANCE' -> 'PAYMENT'
  const advRes = await db.collection('ledgers').updateMany(
    { voucherType: null, refType: 'ADVANCE' },
    { $set: { voucherType: 'PAYMENT' } }
  );
  console.log(`  Updated ${advRes.modifiedCount} ADVANCE ledgers -> voucherType: 'PAYMENT'`);

  // 1C: refType == 'STOCK_MOVEMENT' -> 'STOCK_ADJUSTMENT'
  const stockRes = await db.collection('ledgers').updateMany(
    { voucherType: null, refType: 'STOCK_MOVEMENT' },
    { $set: { voucherType: 'STOCK_ADJUSTMENT' } }
  );
  console.log(`  Updated ${stockRes.modifiedCount} STOCK_MOVEMENT ledgers -> voucherType: 'STOCK_ADJUSTMENT'`);

  // 1D: refType == 'BILL' -> Join with actual Bill document to determine exact btype
  const billLedgers = await db.collection('ledgers').find({ voucherType: null, refType: 'BILL' }).toArray();
  console.log(`  Processing ${billLedgers.length} BILL ledgers linked to Bill master records...`);

  let billsUpdated = 0;
  for (const bl of billLedgers) {
    if (!bl.refId) continue;
    const billDoc = await db.collection('bills').findOne({ _id: bl.refId });
    if (billDoc && billDoc.btype) {
      await db.collection('ledgers').updateOne(
        { _id: bl._id },
        { $set: { voucherType: billDoc.btype } }
      );
      billsUpdated++;
    } else {
      // If no billDoc found, determine based on party leg
      const vtype = bl.accountType === 'SUNDRY_DEBTORS' || bl.accountType === 'INCOME' ? 'SALES' : 'PURCHASE';
      await db.collection('ledgers').updateOne(
        { _id: bl._id },
        { $set: { voucherType: vtype } }
      );
      billsUpdated++;
    }
  }
  console.log(`  Updated ${billsUpdated} BILL ledgers based on linked Bill btype.`);

  // Step 2: Backfill accountCode on ledgers
  console.log('Step 2: Backfilling accountCode on ledgers...');
  let ledgerCodesUpdated = 0;
  for (const [accType, code] of Object.entries(ACCOUNT_CODE_MAP)) {
    const res = await db.collection('ledgers').updateMany(
      { accountCode: null, accountType: accType },
      { $set: { accountCode: code } }
    );
    ledgerCodesUpdated += res.modifiedCount;
  }
  console.log(`  Populated accountCode across ${ledgerCodesUpdated} ledger documents.`);

  // Step 3: Backfill account_code on chartofaccounts
  console.log('Step 3: Backfilling account_code on chartofaccounts...');
  let coaCodesUpdated = 0;
  for (const [accType, code] of Object.entries(ACCOUNT_CODE_MAP)) {
    const res = await db.collection('chartofaccounts').updateMany(
      { account_code: null, account_type: accType },
      { $set: { account_code: code } }
    );
    coaCodesUpdated += res.modifiedCount;
  }
  console.log(`  Populated account_code across ${coaCodesUpdated} chart of accounts entries.`);

  // Step 4: Post-migration Parity Assertion
  const [postStats] = await db.collection('ledgers').aggregate([
    {
      $group: {
        _id: null,
        totalDr: { $sum: '$debitAmount' },
        totalCr: { $sum: '$creditAmount' },
        count: { $sum: 1 }
      }
    }
  ]).toArray();

  const postDrPaise = Math.round(postStats.totalDr * 100);
  const postCrPaise = Math.round(postStats.totalCr * 100);
  console.log(`Post-migration Ledger: ${postStats.count} records | Total DR: ₹${(postDrPaise / 100).toFixed(2)} | Total CR: ₹${(postCrPaise / 100).toFixed(2)}`);

  const remainingNullVouchers = await db.collection('ledgers').countDocuments({ voucherType: null });
  console.log(`Remaining Ledgers with voucherType: null: ${remainingNullVouchers}`);

  if (preDrPaise !== postDrPaise || preCrPaise !== postCrPaise) {
    console.error('FATAL ERROR: Financial amounts mutated during migration!');
    process.exit(1);
  } else {
    console.log('✅ ZERO FINANCIAL DRIFT CONFIRMED: DR & CR amounts match before and after to exact integer paise.');
  }

  await mongoose.disconnect();
  console.log('--- BACKFILL MIGRATION COMPLETE ---');
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

