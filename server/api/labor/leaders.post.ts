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
    const firmId = String(session.firm_id);
    const { name, phone, pan, aadhaar_number, gst_number, bank_name, account_number, ifsc_code } = body;

    if (!name || !name.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'Leader name is required' });
    }

    const b_name = (bank_name && String(bank_name).trim()) || null;
    const a_num = (account_number && String(account_number).trim()) || null;
    const i_code = (ifsc_code && String(ifsc_code).trim()) || null;
    const p_num = (pan && String(pan).trim().toUpperCase()) || null;
    const a_aadhaar = (aadhaar_number && String(aadhaar_number).trim()) || null;
    const g_num = (gst_number && String(gst_number).trim().toUpperCase()) || null;

    const [leader] = await sql`
      INSERT INTO labor_leaders (firm_id, name, phone, pan, aadhaar_number, gst_number, bank_name, account_number, ifsc_code)
      VALUES (${firmId}, ${name.trim()}, ${phone || null}, ${p_num}, ${a_aadhaar}, ${g_num}, ${b_name}, ${a_num}, ${i_code})
      RETURNING *
    `;

    // Sync into MongoDB ChartOfAccounts for accounting & voucher visibility
    try {
      const mongoose = await import('mongoose');
      const ChartOfAccounts = (await import('../../models/ChartOfAccounts')).default;
      const firmIdObj = new mongoose.Types.ObjectId(String(firmId));
      await ChartOfAccounts.findOneAndUpdate(
        { 
          firm_id: firmIdObj,
          account_name: name.trim() 
        },
        {
          $set: {
            pan: p_num,
            aadhaar_number: a_aadhaar,
            gstin: g_num,
            phone: phone || null
          },
          $setOnInsert: {
            firm_id: firmIdObj,
            account_name: name.trim(),
            account_type: 'LABOR_LEADER',
            is_system: false,
            is_active: true,
            created_by: session._id ? new mongoose.Types.ObjectId(String(session._id)) : null
          }
        },
        { upsert: true, returnDocument: 'after' }
      );
    } catch (coaErr) {
      console.warn('Failed to sync leader to ChartOfAccounts:', coaErr);
    }

    return { success: true, data: leader };
  } catch (error: any) {
    console.error('Create labor leader error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error creating labor leader'
    });
  }
});
