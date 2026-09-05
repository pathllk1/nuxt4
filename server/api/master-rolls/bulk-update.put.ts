import MasterRoll from '../../models/MasterRoll';
import mongoose from 'mongoose';
import { requireAuthSession } from '../../utils/auth';
import { pickMasterRollFields } from '../../utils/master-roll-fields';

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
          { ...pickMasterRollFields(update.data || {}), updated_by: user._id },
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