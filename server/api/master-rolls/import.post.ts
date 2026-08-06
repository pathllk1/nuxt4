import MasterRoll from '../../models/MasterRoll';
import { requireAuthSession } from '../../utils/auth';

// Bug #8: allowlist for imported employee records — prevents a client from
// spreading arbitrary fields (e.g. firm_id, _id, created_by) into the model.
const IMPORTABLE_FIELDS = [
  'employee_name',
  'aadhar',
  'bank',
  'account_no',
  'ifsc',
  'branch',
  'category',
  'project',
  'site',
  'p_day_wage',
  'date_of_joining',
  'date_of_exit',
  'status',
] as const;

function pickAllowlisted(emp: Record<string, any>) {
  const clean: Record<string, any> = {};
  for (const field of IMPORTABLE_FIELDS) {
    if (emp[field] !== undefined) {
      clean[field] = emp[field];
    }
  }
  return clean;
}

export default defineEventHandler(async (event) => {
  try {
    // Bug #8: use the verified session instead of trusting the x-firm-id header
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
          ...pickAllowlisted(emp),
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