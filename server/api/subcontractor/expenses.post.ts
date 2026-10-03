import { defineEventHandler, readBody, createError } from 'h3';
import mongoose from 'mongoose';
import { requireAuthSession } from '../../utils/auth';
import User from '../../models/User';
import SubcontractorExpense, { type SubcontractorExpenseCategory } from '../../models/SubcontractorExpense';

/**
 * POST /api/subcontractor/expenses
 * Subcontractor logs a new site expense in his off-core sandbox.
 * CRITICAL: Zero impact on Core General Ledger!
 */
export default defineEventHandler(async (event) => {
  const authSession = await requireAuthSession(event);
  const firmIdObj = new mongoose.Types.ObjectId(String(authSession.firm_id));
  const userIdObj = new mongoose.Types.ObjectId(String(authSession._id));

  const userDoc = await User.findById(userIdObj).lean() as any;
  if (!userDoc) {
    throw createError({ statusCode: 401, statusMessage: 'User not found' });
  }

  const firmAssignment = (userDoc.firms || []).find((f: any) =>
    String(f.firm?._id || f.firm) === String(firmIdObj)
  );

  if (!firmAssignment || firmAssignment.grade !== 'Subcontractor') {
    throw createError({ statusCode: 403, statusMessage: 'Only Subcontractors can log site slips' });
  }

  const body = await readBody(event) || {};
  const {
    expenseDate,
    category,
    amount,
    paymentMode = 'CASH',
    vendorOrPayee,
    notes,
    billOrSlipRef,
    projectId
  } = body;

  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid expense amount greater than zero is required'
    });
  }

  const validCategories: SubcontractorExpenseCategory[] = [
    'LABOR', 
    'MATERIAL', 
    'FUEL_DIESEL', 
    'MACHINERY_RENTAL', 
    'TRANSPORT', 
    'FOOD_WELFARE', 
    'REPAIRS', 
    'OTHER'
  ];

  if (!category || !validCategories.includes(category)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid category. Must be one of: ${validCategories.join(', ')}`
    });
  }

  const cleanDate = expenseDate || new Date().toISOString().split('T')[0];

  const newSlip = await SubcontractorExpense.create({
    firmId: firmIdObj,
    subcontractorUserId: userIdObj,
    subcontractorName: userDoc.name,
    projectId: projectId || (firmAssignment.assignedProjectIds?.[0] || null),
    expenseDate: cleanDate,
    category,
    amount: numAmount,
    paymentMode: ['CASH', 'UPI', 'BANK'].includes(paymentMode) ? paymentMode : 'CASH',
    vendorOrPayee: (vendorOrPayee || '').trim(),
    notes: (notes || '').trim(),
    billOrSlipRef: (billOrSlipRef || '').trim()
  });

  return {
    success: true,
    statusCode: 201,
    message: 'Site expense slip recorded in your wallet',
    slip: newSlip
  };
});
