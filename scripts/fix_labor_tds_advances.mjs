import postgres from 'postgres';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  console.log('Connecting to databases...');
  const sql = postgres(process.env.POSTGRES_URL, { ssl: { rejectUnauthorized: false } });
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB and PostgreSQL.');

  const firmIdObj = new mongoose.Types.ObjectId('6a116b648a70df2218b89cdc');
  const coaCol = mongoose.connection.collection('chartofaccounts');
  const ledgerCol = mongoose.connection.collection('ledgers');

  // 1. Ensure "TDS Borne by Company" account exists in Chart of Accounts
  let tdsBorneAccount = await coaCol.findOne({
    $or: [{ firm_id: firmIdObj }, { firmId: firmIdObj }, { firm_id: '6a116b648a70df2218b89cdc' }, { firmId: '6a116b648a70df2218b89cdc' }],
    account_name: 'TDS Borne by Company'
  });

  if (!tdsBorneAccount) {
    console.log('Creating "TDS Borne by Company" in Chart of Accounts...');
    const insertRes = await coaCol.insertOne({
      firm_id: firmIdObj,
      firmId: firmIdObj,
      account_name: 'TDS Borne by Company',
      account_type: 'EXPENSE',
      bs_classification: 'PNL',
      description: 'TDS Borne by Company u/s 195A (Gross-up)',
      is_system: true,
      is_active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      __v: 0
    });
    tdsBorneAccount = { _id: insertRes.insertedId };
    console.log('Created "TDS Borne by Company" with ID:', insertRes.insertedId);
  } else {
    console.log('"TDS Borne by Company" already exists with ID:', tdsBorneAccount._id);
  }

  // 2. Fix MongoDB Ledgers and PostgreSQL labor_advances
  const vouchersToFix = [
    {
      voucherGroupId: 'PV-2026-27-000200',
      voucherNo: 'PV/2026-27/0200',
      date: '2026-10-01',
      netAmount: 50000.00,
      tdsAmount: 505.05,
      grossAmount: 50505.05,
      rate: 1.00
    },
    {
      voucherGroupId: 'PV-2026-27-000201',
      voucherNo: 'PV/2026-27/0201',
      date: '2026-10-10',
      netAmount: 50000.00,
      tdsAmount: 505.05,
      grossAmount: 50505.05,
      rate: 1.00
    },
    {
      voucherGroupId: 'PV-2026-27-000202',
      voucherNo: 'PV/2026-27/0202',
      date: '2026-10-24',
      netAmount: 30000.00,
      tdsAmount: 303.03,
      grossAmount: 30303.03,
      rate: 1.00
    }
  ];

  for (const v of vouchersToFix) {
    console.log(`\n--- Processing Voucher ${v.voucherGroupId} ---`);

    // A. Update RAJESH PATHAK debit to netAmount
    const updateLeaderRes = await ledgerCol.updateOne(
      { voucherGroupId: v.voucherGroupId, accountType: 'LABOR_LEADER' },
      {
        $set: {
          debitAmount: v.netAmount,
          narration: `Advance to Labor Leader (Net ₹${v.netAmount.toLocaleString('en-IN')}) - TDS grossed up u/s 195A`,
          updatedAt: new Date()
        }
      }
    );
    console.log(`Updated RAJESH PATHAK leg in MongoDB: matched ${updateLeaderRes.matchedCount}, modified ${updateLeaderRes.modifiedCount}`);

    // B. Check or insert "TDS Borne by Company" leg
    const existingExpenseLeg = await ledgerCol.findOne({
      voucherGroupId: v.voucherGroupId,
      accountHead: 'TDS Borne by Company'
    });

    if (!existingExpenseLeg) {
      await ledgerCol.insertOne({
        firmId: firmIdObj,
        transactionDate: v.date,
        accountHead: 'TDS Borne by Company',
        accountType: 'EXPENSE',
        debitAmount: v.tdsAmount,
        creditAmount: 0,
        narration: `TDS Borne by Company u/s 195A @ ${v.rate}% on ₹${v.grossAmount}`,
        refType: 'VOUCHER',
        refId: null,
        voucherGroupId: v.voucherGroupId,
        voucherNo: v.voucherNo,
        voucherType: 'PAYMENT',
        partyId: null,
        stockId: null,
        stockRegId: null,
        bankAccountId: null,
        paymentMode: null,
        isWageEntry: false,
        masterRollId: null,
        isReversed: false,
        createdBy: 'ANJAN PAUL',
        createdAt: new Date(),
        updatedAt: new Date(),
        __v: 0
      });
      console.log(`Inserted "TDS Borne by Company" DR ${v.tdsAmount} into MongoDB.`);
    } else {
      await ledgerCol.updateOne(
        { _id: existingExpenseLeg._id },
        { $set: { debitAmount: v.tdsAmount, updatedAt: new Date() } }
      );
      console.log(`Updated existing "TDS Borne by Company" DR ${v.tdsAmount} in MongoDB.`);
    }

    // C. Verify Double-Entry Balance in MongoDB
    const legs = await ledgerCol.find({ voucherGroupId: v.voucherGroupId }).toArray();
    let totalDebit = 0;
    let totalCredit = 0;
    for (const leg of legs) {
      totalDebit += Number(leg.debitAmount || 0);
      totalCredit += Number(leg.creditAmount || 0);
      console.log(`  Leg: ${leg.accountHead.padEnd(25)} | DR: ${Number(leg.debitAmount || 0).toFixed(2).padStart(10)} | CR: ${Number(leg.creditAmount || 0).toFixed(2).padStart(10)}`);
    }
    console.log(`  Total Debits: ${totalDebit.toFixed(2)} | Total Credits: ${totalCredit.toFixed(2)} | Balanced: ${Math.abs(totalDebit - totalCredit) < 0.01}`);

    if (Math.abs(totalDebit - totalCredit) >= 0.01) {
      throw new Error(`CRITICAL: Voucher ${v.voucherGroupId} is unbalanced! DR: ${totalDebit} vs CR: ${totalCredit}`);
    }

    // D. Update PostgreSQL labor_advances
    const pgUpdateRes = await sql`
      UPDATE labor_advances
      SET 
        amount = ${v.netAmount},
        gross_amount = ${v.grossAmount},
        tds_amount = ${v.tdsAmount},
        tds_mode = 'GROSS_UP',
        tds_rate = ${v.rate}
      WHERE ledger_voucher_group_id = ${v.voucherGroupId}
      RETURNING id, period_id, amount, gross_amount, tds_amount, tds_mode
    `;
    console.log(`Updated PostgreSQL labor_advances:`, pgUpdateRes);
  }

  // 3. Final Verification of the Period
  const periodId = '63f23e66-857e-435d-bf1f-0f782a84b111';
  const [w] = await sql`SELECT COALESCE(SUM(total_wages), 0) as wages FROM labor_workers WHERE period_id = ${periodId}`;
  const [adv] = await sql`SELECT COALESCE(SUM(amount), 0) as adv FROM labor_advances WHERE period_id = ${periodId}`;
  const totalWages = Number(w.wages);
  const totalAdvances = Number(adv.adv);
  const netPayable = totalWages - totalAdvances;

  console.log('\n=========================================');
  console.log('FINAL RECONCILIATION FOR PERIOD: ' + periodId);
  console.log('Total Muster Wages:      ₹' + totalWages.toFixed(2));
  console.log('Total Advances Deducted: ₹' + totalAdvances.toFixed(2));
  console.log('Net Payable to Leader:   ₹' + netPayable.toFixed(2));
  console.log('Expected Net Payable:    ₹87,750.00');
  console.log('Reconciliation MATCH:    ' + (netPayable === 87750 ? 'YES! SUCCESS' : 'NO - MISMATCH'));
  console.log('=========================================\n');

  await sql.end();
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
