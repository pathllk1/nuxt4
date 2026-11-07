import postgres from 'postgres';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const sql = postgres(process.env.POSTGRES_URL, { ssl: { rejectUnauthorized: false } });
  await mongoose.connect(process.env.MONGODB_URI);

  // 1. Search in MongoDB for all vouchers with TDS or 195A or Grossed-up in narration
  const grossUpVouchers = await mongoose.connection.collection('ledgers').find({
    $or: [
      { narration: { $regex: 'Grossed-up|195A|Gross-Up', $options: 'i' } },
      { 'tags.tdsMode': 'GROSS_UP' }
    ]
  }).toArray();

  console.log(`\n=== Found ${grossUpVouchers.length} Gross-Up Ledger Entries ===`);
  const voucherGroupIds = [...new Set(grossUpVouchers.map(v => v.voucherGroupId))];
  console.log('Voucher Group IDs:', voucherGroupIds);

  for (const vgId of voucherGroupIds) {
    const legs = await mongoose.connection.collection('ledgers').find({ voucherGroupId: vgId }).toArray();
    console.log(`\nVoucher: ${vgId} (${legs[0]?.voucherType}) on ${legs[0]?.transactionDate}`);
    for (const l of legs) {
      console.log(`  ${l.accountHead} (${l.accountType}) | DR: ${l.debitAmount} | CR: ${l.creditAmount} | ${l.narration}`);
    }
  }

  // 2. Search in PostgreSQL labor_advances
  const allAdv = await sql`
    SELECT * FROM labor_advances 
    WHERE ledger_voucher_group_id IN ${sql(voucherGroupIds.length ? voucherGroupIds : ['none'])}
       OR tds_mode = 'GROSS_UP'
       OR amount IN (50505.05, 30303.03)
  `;
  console.log(`\n=== Linked PG labor_advances (${allAdv.length}) ===`);
  for (const a of allAdv) {
    console.log({
      id: a.id,
      period_id: a.period_id,
      amount: a.amount,
      gross_amount: a.gross_amount,
      tds_amount: a.tds_amount,
      tds_mode: a.tds_mode,
      voucher: a.ledger_voucher_group_id
    });
  }

  await sql.end();
  await mongoose.disconnect();
}
run();

