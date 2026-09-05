import MasterRoll from '../../models/MasterRoll';
import { requireAuthSession } from '../../utils/auth';
import { pickMasterRollFields } from '../../utils/master-roll-fields';

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthSession(event);

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
          ...pickMasterRollFields(emp),
          firm_id: user.firm_id,
          created_by: user._id,
          updated_by: user._id
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