import { defineEventHandler, createError, getRouterParam } from 'h3';
import MasterRoll from '../../models/MasterRoll';
import Wage from '../../models/Wage';
import Advance from '../../models/Advance';
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

    const empObjectId = new mongoose.Types.ObjectId(id);

    // 1. Guard against orphaned wages
    const wageCount = await Wage.countDocuments({ firm_id: user.firm_id, master_roll_id: empObjectId });
    if (wageCount > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: `Cannot delete employee: ${wageCount} historical wage records exist. Change employee status to 'Inactive' or 'Left' to archive.`
      });
    }

    // 2. Guard against orphaned advances
    const advCount = await Advance.countDocuments({ firm_id: user.firm_id, master_roll_id: empObjectId });
    if (advCount > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: `Cannot delete employee: ${advCount} advance/loan records exist. Clear advances or mark employee as 'Inactive'.`
      });
    }

    const employee = await MasterRoll.findOneAndDelete({
      _id: empObjectId,
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
