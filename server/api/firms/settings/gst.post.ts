import { defineEventHandler, readBody, createError } from 'h3';
import FirmSettings from '../../../models/FirmSettings';
import { requireAuthSession } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    // Fix #7: Use requireAuthSession instead of raw x-firm-id header
    const user = await requireAuthSession(event);
    const firmId = user.firm_id.toString();

    const { enabled } = await readBody(event);
    if (enabled === undefined) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Enabled parameter is required'
      });
    }

    const settingValue = enabled ? 'true' : 'false';

    await FirmSettings.findOneAndUpdate(
      { firmId, settingKey: 'gst_enabled' },
      { $set: { settingValue } },
      { upsert: true, returnDocument: 'after' }
    );

    return {
      success: true,
      statusCode: 200,
      message: `GST has been ${enabled ? 'enabled' : 'disabled'} successfully`,
      data: { gst_enabled: enabled }
    };
  } catch (error: any) {
    console.error('Toggle GST status error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error updating GST status'
    });
  }
});
