import { defineEventHandler, getHeader, readBody, createError } from 'h3';
import FirmSettings from '../../../models/FirmSettings';

export default defineEventHandler(async (event) => {
  try {
    const firmId = getHeader(event, 'x-firm-id');
    if (!firmId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'X-Firm-ID header is required'
      });
    }

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
      { upsert: true, new: true }
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
