import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const sql = postgres(process.env.POSTGRES_URL, { ssl: { rejectUnauthorized: false } });
  const periodId = '63f23e66-857e-435d-bf1f-0f782a84b111';
  const p = await sql`SELECT p.*, l.name as leader_name FROM labor_periods p JOIN labor_leaders l ON p.leader_id = l.id WHERE p.id = ${periodId}`;
  const [w] = await sql`SELECT COALESCE(SUM(total_wages), 0) as wages FROM labor_workers WHERE period_id = ${periodId}`;
  const [adv] = await sql`SELECT COALESCE(SUM(amount), 0) as adv FROM labor_advances WHERE period_id = ${periodId}`;
  console.log('Period:', {
    id: p[0]?.id,
    leader: p[0]?.leader_name,
    status: p[0]?.status,
    dates: `${p[0]?.start_date?.toISOString().slice(0,10)} to ${p[0]?.end_date?.toISOString().slice(0,10)}`
  });
  console.log('Total Wages:', w?.wages);
  console.log('Total Advances in DB:', adv?.adv);
  console.log('Net Payable calculated right now:', Number(w?.wages) - Number(adv?.adv));
  await sql.end();
}
run();

