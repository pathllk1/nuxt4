import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

async function inspectPg() {
  if (!connectionString) {
    console.log('No PostgreSQL connection string found');
    return;
  }
  const sql = postgres(connectionString, { ssl: { rejectUnauthorized: false } });

  console.log('--- POSTGRESQL LABOR TABLES INSPECTION ---');
  try {
    const leaderCount = await sql`SELECT count(*) FROM labor_leaders`;
    const periodCount = await sql`SELECT count(*) FROM labor_periods`;
    const workerCount = await sql`SELECT count(*) FROM labor_workers`;
    const attendanceCount = await sql`SELECT count(*) FROM labor_attendance`;
    const expenseCount = await sql`SELECT count(*) FROM labor_expenses`;
    const advanceCount = await sql`SELECT count(*) FROM labor_advances`;
    const settlementCount = await sql`SELECT count(*) FROM labor_settlements`;

    console.log({
      labor_leaders: leaderCount[0].count,
      labor_periods: periodCount[0].count,
      labor_workers: workerCount[0].count,
      labor_attendance: attendanceCount[0].count,
      labor_expenses: expenseCount[0].count,
      labor_advances: advanceCount[0].count,
      labor_settlements: settlementCount[0].count
    });

    const leaders = await sql`SELECT id, name, pan, phone FROM labor_leaders LIMIT 10`;
    console.log('--- SAMPLE LABOR LEADERS ---');
    console.table(leaders);

    const advances = await sql`SELECT id, period_id, amount, payment_date, ledger_voucher_group_id FROM labor_advances LIMIT 10`;
    console.log('--- SAMPLE LABOR ADVANCES ---');
    console.table(advances);

    const settlements = await sql`SELECT id, period_id, total_wages, paid_amount, payment_date, ledger_voucher_group_id FROM labor_settlements LIMIT 10`;
    console.log('--- SAMPLE LABOR SETTLEMENTS ---');
    console.table(settlements);

  } catch (err) {
    console.error('PostgreSQL query error:', err.message);
  } finally {
    await sql.end();
  }
}

inspectPg().catch(console.error);

