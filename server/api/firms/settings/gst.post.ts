import { defineEventHandler, readBody, createError } from 'h3';
import FirmSettings from '../../../models/FirmSettings';
import User from '../../../models/User';
import { requireAuthSession } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    // Fix #7: Use requireAuthSession instead of raw x-firm-id header
    const user = await requireAuthSession(event);
    const firmId = user.firm_id.toString();

    // Security: Only Owner, Admin, or Superadmin can change firm tax settings
    const currentUser: any = event.context.userDoc || await User.findById(user._id).lean();
    const isSuperAdmin = currentUser?.role === 'superadmin';
    const assignment = (currentUser?.firms || []).find((f: any) => String(f.firm?._id || f.firm) === firmId);
    const grade = assignment?.grade;

    if (!isSuperAdmin && !['Owner', 'Admin'].includes(grade)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden: Only Firm Owners or Admins can modify GST configuration'
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
