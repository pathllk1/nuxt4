import { defineEventHandler, createError, readBody } from 'h3';
import MasterRoll from '../models/MasterRoll';
import { requireAuthSession } from '../utils/auth';

// Fix #8: Allowlist to prevent mass assignment — matches [id].put.ts pattern
const ALLOWED_FIELDS = [
  'employee_name',
  'aadhar',
  'phone_no',
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

function pickAllowed(data: Record<string, any>) {
  const clean: Record<string, any> = {};
  for (const field of ALLOWED_FIELDS) {
    if (data[field] !== undefined) {
      clean[field] = data[field];
    }
  }
  return clean;
}

export default defineEventHandler(async (event) => {
  try {
    // Fix #7: Use requireAuthSession instead of raw x-firm-id header
    const user = await requireAuthSession(event);

    const body = await readBody(event);

    if (!body.employee_name || !body.aadhar || !body.phone_no || !body.bank || !body.account_no || !body.ifsc || !body.date_of_joining) {
      throw createError({ statusCode: 400, statusMessage: 'Missing required fields' });
    }

    const employee = await MasterRoll.create({
      ...pickAllowed(body),
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
    console.error('Create master-roll error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error creating employee'
    });
  }
});
