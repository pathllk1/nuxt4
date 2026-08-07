import { defineEventHandler, readBody, createError } from 'h3';
import { requireAuthSession } from '../../utils/auth';
import { getSql, connectPostgres } from '../../utils/pg.config';

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    let sql = getSql();
    if (!sql) sql = await connectPostgres();
    if (!sql) throw createError({ statusCode: 503, statusMessage: 'PostgreSQL database connection not ready' });

    const body = await readBody(event);
    const firmId = body.firm_id || session.firm_id;
    const { name, phone, bank_name, account_number, ifsc_code } = body;

    if (!name || !name.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'Leader name is required' });
    }

    const b_name = (bank_name && String(bank_name).trim()) || null;
    const a_num = (account_number && String(account_number).trim()) || null;
    const i_code = (ifsc_code && String(ifsc_code).trim()) || null;

    const [leader] = await sql`
      INSERT INTO labor_leaders (firm_id, name, phone, bank_name, account_number, ifsc_code)
      VALUES (${firmId}, ${name.trim()}, ${phone || null}, ${b_name}, ${a_num}, ${i_code})
      RETURNING *
    `;

    return { success: true, data: leader };
  } catch (error: any) {
    console.error('Create labor leader error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error creating labor leader'
    });
  }
});
