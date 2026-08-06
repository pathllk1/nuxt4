import MasterRoll from '../../models/MasterRoll';
import mongoose from 'mongoose';
import { requireAuthSession } from '../../utils/auth';

// Bug (report B2): same allowlist used in [id].put.ts — kept in sync manually
// since there's no shared constants file for this yet. Consider extracting
// to a shared `master-roll-fields.ts` if a third endpoint ever needs it.
const EDITABLE_FIELDS = [
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

function pickEditable(data: Record<string, any>) {
  const clean: Record<string, any> = {};
  for (const field of EDITABLE_FIELDS) {
    if (data[field] !== undefined) {
      clean[field] = data[field];
    }
  }
  return clean;
}

export default defineEventHandler(async (event) => {
  try {
    // Bug (report B2): use the verified session instead of the x-firm-id header
    const user = await requireAuthSession(event);

    const body = await readBody(event);
    const updates = body.updates || [];

    if (!Array.isArray(updates) || updates.length === 0) {
      throw createError({ statusCode: 400, statusMessage: 'No updates provided' });
    }

    let updated = 0;
    let failed = 0;
    for (const update of updates) {
      if (!update?.id || !mongoose.isValidObjectId(update.id)) {
        failed++;
        continue;
      }
      try {
        await MasterRoll.findOneAndUpdate(
          { _id: new mongoose.Types.ObjectId(update.id), firm_id: user.firm_id },
          { ...pickEditable(update.data || {}), updated_by: user._id },
          { runValidators: true }
        );
        updated++;
      } catch (err) {
        failed++;
        console.warn('Bulk update employee failed:', update.id, err);
      }
    }

    return {
      success: true,
      message: `Updated ${updated} employees${failed ? `, ${failed} failed` : ''}`,
      updated,
      failed
    };
  } catch (error: any) {
    console.error('Bulk update master-rolls error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error bulk updating employees'
    });
  }
});