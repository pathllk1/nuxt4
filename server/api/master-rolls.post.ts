import { defineEventHandler, createError, readBody, getHeader } from 'h3';
import MasterRoll from '../models/MasterRoll';
import mongoose from 'mongoose';

export default defineEventHandler(async (event) => {
  try {
    const firmId = getHeader(event, 'x-firm-id');
    if (!firmId) {
      throw createError({ statusCode: 400, statusMessage: 'Firm context required' });
    }

    const user = event.context.user;
    const body = await readBody(event);

    if (!body.employee_name || !body.aadhar || !body.phone_no || !body.bank || !body.account_no || !body.ifsc || !body.date_of_joining) {
      throw createError({ statusCode: 400, statusMessage: 'Missing required fields' });
    }

    const employee = await MasterRoll.create({
      ...body,
      firm_id: new mongoose.Types.ObjectId(firmId),
      created_by: user?.id ? new mongoose.Types.ObjectId(user.id) : null,
      updated_by: user?.id ? new mongoose.Types.ObjectId(user.id) : null
    });

    return {
      success: true,
      message: 'Employee created successfully',
      data: employee
    };
  } catch (error: any) {
    if (error.code === 11000) {
      throw createError({ statusCode: 409, statusMessage: 'Employee with this Aadhar number already exists' });
    }
    console.error('Create master-roll error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error creating employee'
    });
  }
});
