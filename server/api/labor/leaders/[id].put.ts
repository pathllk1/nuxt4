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
    const { name, phone, pan, aadhaar_number, gst_number, bank_name, account_number, ifsc_code, status } = body;

    const b_name = bank_name !== undefined ? (bank_name && String(bank_name).trim()) || null : undefined;
    const a_num = account_number !== undefined ? (account_number && String(account_number).trim()) || null : undefined;
    const i_code = ifsc_code !== undefined ? (ifsc_code && String(ifsc_code).trim()) || null : undefined;
    const p_num = pan !== undefined ? (pan && String(pan).trim().toUpperCase()) || null : undefined;
    const a_aadhaar = aadhaar_number !== undefined ? (aadhaar_number && String(aadhaar_number).trim()) || null : undefined;
    const g_num = gst_number !== undefined ? (gst_number && String(gst_number).trim().toUpperCase()) || null : undefined;

    // Get previous leader name to update COA if name changed
    const [existingLeader] = await sql`
      SELECT name FROM labor_leaders WHERE id = ${id}
    `;

    const [leader] = await sql`
      UPDATE labor_leaders 
      SET 
        name = ${name ? name.trim() : sql`name`},
        phone = ${phone !== undefined ? phone : sql`phone`},
        pan = ${p_num !== undefined ? p_num : sql`pan`},
        aadhaar_number = ${a_aadhaar !== undefined ? a_aadhaar : sql`aadhaar_number`},
        gst_number = ${g_num !== undefined ? g_num : sql`gst_number`},
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

    try {
      const mongoose = await import('mongoose');
      const ChartOfAccounts = (await import('../../../models/ChartOfAccounts')).default;
      const targetName = existingLeader?.name || name?.trim();
      if (targetName) {
        const updateFields: any = {};
        if (name) updateFields.account_name = name.trim();
        if (pan !== undefined) updateFields.pan = p_num;
        if (aadhaar_number !== undefined) updateFields.aadhaar_number = a_aadhaar;
        if (gst_number !== undefined) updateFields.gstin = g_num;
        if (phone !== undefined) updateFields.phone = phone;

        await ChartOfAccounts.updateMany(
          { account_name: targetName },
          { $set: updateFields }
        );
      }
    } catch (coaErr) {
      console.warn('Failed to update leader fields in COA:', coaErr);
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
