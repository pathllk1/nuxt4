import { defineEventHandler, getHeader, createError } from 'h3';
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
