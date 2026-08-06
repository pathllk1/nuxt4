import MasterRoll from '../../models/MasterRoll';
import mongoose from 'mongoose';
import { requireAuthSession } from '../../utils/auth';

// Bug #7: explicit allowlist — request body can no longer inject firm_id,
// created_by, _id, or any other protected field via spread.
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

export default defineEventHandler(async (event) => {
  try {
    // Bug #7: use the verified session instead of trusting the x-firm-id
    // header + event.context.user directly.
    const user = await requireAuthSession(event);

    const id = getRouterParam(event, 'id');
    if (!id || !mongoose.isValidObjectId(id)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid employee id' });
    }

    const body = await readBody(event);
    const update: Record<string, any> = { updated_by: user._id };
    for (const field of EDITABLE_FIELDS) {
      if (body[field] !== undefined) {
        update[field] = body[field];
      }
    }

    const employee = await MasterRoll.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id), firm_id: user.firm_id },
      update,
      { new: true, runValidators: true }
    );

    if (!employee) {
      throw createError({ statusCode: 404, statusMessage: 'Employee not found' });
    }

    return {
      success: true,
      message: 'Employee updated successfully',
      data: employee
    };
  } catch (error: any) {
    console.error('Update master-roll error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error updating employee'
    });
  }
});