import { defineEventHandler, createError } from 'h3';
import FirmSettings from '../../../models/FirmSettings';
import { requireAuthSession } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    // Fix #7: Use requireAuthSession instead of raw x-firm-id header
    const user = await requireAuthSession(event);
    const firmId = user.firm_id.toString();

    const setting = await FirmSettings.findOne({
      firmId,
      settingKey: 'gst_enabled'
    }).lean();

    const gstEnabled = setting ? setting.settingValue === 'true' : true;

    return {
      success: true,
      statusCode: 200,
      data: { gst_enabled: gstEnabled }
    };
  } catch (error: any) {
    console.error('Get GST status error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error fetching GST status'
    });
  }
});
