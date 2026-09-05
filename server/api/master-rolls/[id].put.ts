import MasterRoll from '../../models/MasterRoll';
import mongoose from 'mongoose';
import { requireAuthSession } from '../../utils/auth';
import { pickMasterRollFields } from '../../utils/master-roll-fields';

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthSession(event);

    const id = getRouterParam(event, 'id');
    if (!id || !mongoose.isValidObjectId(id)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid employee id' });
    }

    const body = await readBody(event);
    const update: Record<string, any> = {
      ...pickMasterRollFields(body || {}),
      updated_by: user._id
    };

    const employee = await MasterRoll.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id), firm_id: user.firm_id },
      update,
      { returnDocument: 'after', runValidators: true }
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
    if (error.name === 'ValidationError') {
      throw createError({ statusCode: 400, statusMessage: error.message });
    }
    console.error('Update master-roll error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error updating employee'
    });
  }
});