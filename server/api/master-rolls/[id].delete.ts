import { defineEventHandler, createError, getHeader, getRouterParam } from 'h3';
import MasterRoll from '../../models/MasterRoll';
import mongoose from 'mongoose';

export default defineEventHandler(async (event) => {
  try {
    const firmId = getHeader(event, 'x-firm-id');
    if (!firmId) {
      throw createError({ statusCode: 400, statusMessage: 'Firm context required' });
    }

    const id = getRouterParam(event, 'id');

    const employee = await MasterRoll.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(id!),
      firm_id: new mongoose.Types.ObjectId(firmId)
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
