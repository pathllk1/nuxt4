import { defineEventHandler, createError, readBody, getHeader, getRouterParam } from 'h3';
import MasterRoll from '../../models/MasterRoll';
import mongoose from 'mongoose';

export default defineEventHandler(async (event) => {
  try {
    const firmId = getHeader(event, 'x-firm-id');
    if (!firmId) {
      throw createError({ statusCode: 400, statusMessage: 'Firm context required' });
    }

    const id = getRouterParam(event, 'id');
    const user = event.context.user;
    const body = await readBody(event);

    const employee = await MasterRoll.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id!), firm_id: new mongoose.Types.ObjectId(firmId) },
      { ...body, updated_by: user?.id ? new mongoose.Types.ObjectId(user.id) : null },
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
