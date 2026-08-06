import { defineEventHandler, createError, getRouterParam } from 'h3';
import MasterRoll from '../../models/MasterRoll';
import mongoose from 'mongoose';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    // Fix #7: Use requireAuthSession instead of raw x-firm-id header
    const user = await requireAuthSession(event);

    const id = getRouterParam(event, 'id');
    if (!id || !mongoose.isValidObjectId(id)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid employee id' });
    }

    const employee = await MasterRoll.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(id),
      firm_id: user.firm_id
    });

    if (!employee) {
      throw createError({ statusCode: 404, statusMessage: 'Employee not found' });
    }

    return {
      success: true,
      message: 'Employee deleted successfully'
    };
  } catch (error: any) {
    console.error('Delete master-roll error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error deleting employee'
    });
  }
});
