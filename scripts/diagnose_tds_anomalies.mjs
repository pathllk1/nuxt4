import postgres from 'postgres';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function diagnose() {
  console.log('--- STARTING TDS & DOUBLE-ENTRY DIAGNOSTIC ---');

  const mongoUri = process.env.MONGODB_URI;
  const pgUrl = process.env.POSTGRES_URL;

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
  console.log('MongoDB connected successfully.');

  console.log('Connecting to PostgreSQL...');
  const sql = postgres(pgUrl, { ssl: { rejectUnauthorized: false }, connect_timeout: 8 });
  console.log('PostgreSQL connected successfully.');

  const ledgerCol = mongoose.connection.collection('ledgers');

  // Target vouchers seen in screenshot
  const targetVoucherNos = [
    'PV/2026-27/0200',
    'PV/2026-27/0018',
    'PV/2026-27/0201',
    'PV/2026-27/0202'
  ];

  console.log('\n======================================================');
  console.log('1. INSPECTING TARGET VOUCHERS IN MONGODB LEDGERS');
  console.log('======================================================');

  for (const vNo of targetVoucherNos) {
    console.log(`\n>>> VOUCHER NUMBER: ${vNo}`);
    const legs = await ledgerCol.find({
      $or: [
        { voucherNo: vNo },
        { voucherGroupId: vNo.replace(/\//g, '-') },
        { voucherGroupId: vNo }
      ]
    }).toArray();

    if (legs.length === 0) {
      console.log(`  No legs found matching voucher ${vNo}`);
      continue;
    }

    let totalDr = 0;
    let totalCr = 0;
    const vGroupId = legs[0]?.voucherGroupId;
    console.log(`  VoucherGroupId: ${vGroupId} | Date: ${legs[0]?.transactionDate} | Type: ${legs[0]?.voucherType} | Leg Count: ${legs.length}`);

    legs.forEach((l, idx) => {
      const dr = Number(l.debitAmount || 0);
      const cr = Number(l.creditAmount || 0);
      totalDr += dr;
      totalCr += cr;
      console.log(`  [Leg ${idx + 1}] Head: "${l.accountHead}" | Type: ${l.accountType} | DR: ${dr.toFixed(2)} | CR: ${cr.toFixed(2)} | Narration: "${l.narration || ''}"`);
    });

    const diff = Math.abs(totalDr - totalCr);
    console.log(`  --> Total DR: ₹${totalDr.toFixed(2)} | Total CR: ₹${totalCr.toFixed(2)} | Balanced: ${diff < 0.01 ? 'YES (0.00)' : `NO (DIFF: ${diff.toFixed(2)})`}`);
  }

  console.log('\n======================================================');
  console.log('2. SCANNING ALL VOUCHERS WITH TDS ENTRIES IN MONGODB');
  console.log('======================================================');

  // Find all legs that mention TDS in accountHead or narration or accountType DUTIES_AND_TAXES
  const allTdsLegs = await ledgerCol.find({
    $or: [
      { accountHead: { $regex: 'tds', $options: 'i' } },
      { narration: { $regex: 'tds', $options: 'i' } }
    ]
  }).toArray();

  console.log(`Found total ${allTdsLegs.length} legs mentioning 'tds' across all vouchers.`);
  const allVgIds = [...new Set(allTdsLegs.map(l => l.voucherGroupId).filter(Boolean))];
  console.log(`Unique VoucherGroupIds involved: ${allVgIds.length}`);

  let unbalancedCount = 0;
  for (const vgId of allVgIds) {
    const legs = await ledgerCol.find({ voucherGroupId: vgId }).toArray();
    let dr = 0;
    let cr = 0;
    for (const l of legs) {
      dr += Number(l.debitAmount || 0);
      cr += Number(l.creditAmount || 0);
    }
    const diff = Math.abs(dr - cr);
    if (diff >= 0.01) {
      unbalancedCount++;
      console.log(`  ⚠️ UNBALANCED VOUCHER: ${vgId} | DR: ${dr.toFixed(2)} | CR: ${cr.toFixed(2)} | Diff: ${diff.toFixed(2)}`);
    }
  }

  if (unbalancedCount === 0) {
    console.log(`  ✓ All ${allVgIds.length} vouchers with TDS entries are perfectly balanced (ΣDR === ΣCR)!`);
  }

  console.log('\n======================================================');
  console.log('3. INSPECTING POSTGRESQL labor_advances');
  console.log('======================================================');

  const pgAdvances = await sql`
    SELECT id, period_id, amount, gross_amount, tds_amount, tds_mode, tds_rate, ledger_voucher_group_id, payment_date
    FROM labor_advances
    WHERE ledger_voucher_group_id IN ${sql(allVgIds.length ? allVgIds : ['none'])}
       OR tds_mode IS NOT NULL
    ORDER BY payment_date DESC
  `;

  console.log(`Found ${pgAdvances.length} labor_advances linked to TDS / vouchers:`);
  for (const adv of pgAdvances) {
    console.log(`  PG Adv ID: ${adv.id} | Period: ${adv.period_id} | VoucherGroupId: ${adv.ledger_voucher_group_id} | Net Amt: ${adv.amount} | Gross: ${adv.gross_amount} | TDS Amt: ${adv.tds_amount} | Mode: ${adv.tds_mode}`);
  }

  await sql.end();
  await mongoose.disconnect();
  console.log('\n--- DIAGNOSTIC COMPLETE ---');
}

diagnose().catch(err => {
  console.error('Diagnostic error:', err);
  process.exit(1);
});

