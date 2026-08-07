import { defineEventHandler, readBody, createError } from 'h3';
import { requireAuthSession } from '../../../utils/auth';
import { getSql, connectPostgres } from '../../../utils/pg.config';

export default defineEventHandler(async (event) => {
  try {
    await requireAuthSession(event);
    let sql = getSql();
    if (!sql) sql = await connectPostgres();
    if (!sql) throw createError({ statusCode: 503, statusMessage: 'PostgreSQL database connection not ready' });

    const id = event.context.params?.id;
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Leader ID is required' });

    const body = await readBody(event);
    const { name, phone, bank_name, account_number, ifsc_code, status } = body;

    const b_name = bank_name !== undefined ? (bank_name && String(bank_name).trim()) || null : undefined;
    const a_num = account_number !== undefined ? (account_number && String(account_number).trim()) || null : undefined;
    const i_code = ifsc_code !== undefined ? (ifsc_code && String(ifsc_code).trim()) || null : undefined;

    const [leader] = await sql`
      UPDATE labor_leaders 
      SET 
        name = ${name ? name.trim() : sql`name`},
        phone = ${phone !== undefined ? phone : sql`phone`},
        bank_name = ${b_name !== undefined ? b_name : sql`bank_name`},
        account_number = ${a_num !== undefined ? a_num : sql`account_number`},
        ifsc_code = ${i_code !== undefined ? i_code : sql`ifsc_code`},
        status = ${status || sql`status`},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    if (!leader) {
      throw createError({ statusCode: 404, statusMessage: 'Labor leader not found' });
    }

    return { success: true, data: leader };
  } catch (error: any) {
    console.error('Update labor leader error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error updating labor leader'
    });
  }
});
