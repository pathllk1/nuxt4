import { defineEventHandler, createError, readBody } from 'h3';
import MasterRoll from '../models/MasterRoll';
import { requireAuthSession } from '../utils/auth';
import { pickMasterRollFields } from '../utils/master-roll-fields';

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthSession(event);
    const body = await readBody(event);

    const requiredFields = [
      'employee_name',
      'father_husband_name',
      'date_of_birth',
      'aadhar',
      'phone_no',
      'address',
      'bank',
      'account_no',
      'ifsc',
      'date_of_joining',
    ] as const;

    const missing = requiredFields.filter(f => !body?.[f] || (typeof body[f] === 'string' && !body[f].trim()));
    if (missing.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: `Missing required fields: ${missing.join(', ')}`
      });
    }

    const employee = await MasterRoll.create({
      ...pickMasterRollFields(body),
      firm_id: user.firm_id,
      created_by: user._id,
      updated_by: user._id
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
    if (error.name === 'ValidationError') {
      throw createError({ statusCode: 400, statusMessage: error.message });
    }
    console.error('Create master-roll error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error creating employee'
    });
  }
});
