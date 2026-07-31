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
    const updates = body.updates || [];

    if (!Array.isArray(updates) || updates.length === 0) {
      throw createError({ statusCode: 400, statusMessage: 'No updates provided' });
    }

    let updated = 0;
    for (const update of updates) {
      try {
        await MasterRoll.findOneAndUpdate(
          { _id: new mongoose.Types.ObjectId(update.id), firm_id: new mongoose.Types.ObjectId(firmId) },
          { ...update.data, updated_by: user?.id ? new mongoose.Types.ObjectId(user.id) : null },
          { runValidators: true }
        );
        updated++;
      } catch (err) {
        console.warn('Bulk update employee failed:', update.id, err);
      }
    }

    return {
      success: true,
      message: `Updated ${updated} employees`,
      updated
    };
  } catch (error: any) {
    console.error('Bulk update master-rolls error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error bulk updating employees'
    });
  }
});
