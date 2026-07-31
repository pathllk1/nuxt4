import { defineEventHandler, createError, readBody, getHeader } from 'h3';
import MasterRoll from '../../models/MasterRoll';
import mongoose from 'mongoose';

export default defineEventHandler(async (event) => {
  try {
    const firmId = getHeader(event, 'x-firm-id');
    if (!firmId) {
      throw createError({ statusCode: 400, statusMessage: 'Firm context required' });
    }

    const user = event.context.user;
    const body = await readBody(event);
    const employees = body.employees || [];

    if (!Array.isArray(employees) || employees.length === 0) {
      throw createError({ statusCode: 400, statusMessage: 'No employees provided' });
    }

    let imported = 0;
    let failed = 0;
    const errors: any[] = [];

    for (const emp of employees) {
      try {
        await MasterRoll.create({
          ...emp,
          firm_id: new mongoose.Types.ObjectId(firmId),
          created_by: user?.id ? new mongoose.Types.ObjectId(user.id) : null,
          updated_by: user?.id ? new mongoose.Types.ObjectId(user.id) : null
        });
        imported++;
      } catch (err: any) {
        failed++;
        errors.push({ employee: emp.employee_name, error: err.message });
      }
    }

    return {
      success: true,
      message: `Import complete: ${imported} imported, ${failed} failed`,
      data: { imported, failed, errors }
    };
  } catch (error: any) {
    console.error('Bulk import master-rolls error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error importing employees'
    });
  }
});
