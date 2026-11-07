import postgres from 'postgres';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const pgUrl = process.env.POSTGRES_URL;
const mongoUri = process.env.MONGODB_URI;

async function run() {
  console.log('Connecting to PG and Mongo...');
  const sql = postgres(pgUrl, { ssl: { rejectUnauthorized: false } });
  await mongoose.connect(mongoUri);
  console.log('Connected!');

  // 1. Fetch recent advances
  const advances = await sql`
    SELECT a.*, p.status as period_status, p.start_date, p.end_date, l.name as leader_name
    FROM labor_advances a
    LEFT JOIN labor_periods p ON a.period_id = p.id
    LEFT JOIN labor_leaders l ON p.leader_id = l.id
    ORDER BY a.payment_date DESC, a.created_at DESC
    LIMIT 15
  `;

  console.log(`\n=== Found ${advances.length} Labor Advances in PG ===`);
  for (const adv of advances) {
    console.log(JSON.stringify({
      id: adv.id,
      leader: adv.leader_name,
      period_id: adv.period_id,
      period_status: adv.period_status,
      dates: `${adv.start_date ? adv.start_date.toISOString().slice(0,10) : ''} to ${adv.end_date ? adv.end_date.toISOString().slice(0,10) : ''}`,
      amount: adv.amount,
      gross_amount: adv.gross_amount,
      tds_mode: adv.tds_mode,
      tds_rate: adv.tds_rate,
      tds_amount: adv.tds_amount,
      payment_date: adv.payment_date ? adv.payment_date.toISOString().slice(0,10) : '',
      ledger_voucher_group_id: adv.ledger_voucher_group_id
    }, null, 2));

    if (adv.ledger_voucher_group_id) {
      const legs = await mongoose.connection.collection('ledgers').find({
        voucherGroupId: adv.ledger_voucher_group_id
      }).toArray();
      console.log(`--- Ledger entries for ${adv.ledger_voucher_group_id} ---`);
      for (const leg of legs) {
        console.log(`  ${leg.accountHead} (${leg.accountType}) | DR: ${leg.debitAmount} | CR: ${leg.creditAmount} | ${leg.narration}`);
      }
    }
  }

  // 2. Fetch Period settlements if any
  const settlements = await sql`
    SELECT s.*, p.leader_id, l.name as leader_name
    FROM labor_settlements s
    JOIN labor_periods p ON s.period_id = p.id
    JOIN labor_leaders l ON p.leader_id = l.id
    ORDER BY s.created_at DESC
    LIMIT 5
  `;
  console.log(`\n=== Found ${settlements.length} Settlements ===`);
  for (const set of settlements) {
    console.log(JSON.stringify({
      id: set.id,
      leader: set.leader_name,
      total_wages: set.total_wages,
      total_expenses: set.total_expenses,
      total_advances: set.total_advances,
      net_payable: set.net_payable,
      paid_amount: set.paid_amount,
      ledger_voucher_group_id: set.ledger_voucher_group_id
    }, null, 2));
    if (set.ledger_voucher_group_id) {
      const legs = await mongoose.connection.collection('ledgers').find({
        voucherGroupId: set.ledger_voucher_group_id
      }).toArray();
      console.log(`--- Settlement Ledger entries for ${set.ledger_voucher_group_id} ---`);
      for (const leg of legs) {
        console.log(`  ${leg.accountHead} (${leg.accountType}) | DR: ${leg.debitAmount} | CR: ${leg.creditAmount} | ${leg.narration}`);
      }
    }
  }

  await sql.end();
  await mongoose.disconnect();
}

run().catch(console.error);

