import { defineEventHandler, readBody, createError } from 'h3';
import mongoose from 'mongoose';
import { requireAuthSession } from '../../../utils/auth';
import SubcontractorExpense, { type SubcontractorExpenseCategory } from '../../../models/SubcontractorExpense';
import User from '../../../models/User';

/**
 * PUT /api/subcontractor/expenses/:id
 * Subcontractor updates an existing site slip in his wallet.
 * ZERO impact on Core General Ledger!
 */
export default defineEventHandler(async (event) => {
  const authSession = await requireAuthSession(event);
  const firmIdObj = new mongoose.Types.ObjectId(String(authSession.firm_id));
  const userIdObj = new mongoose.Types.ObjectId(String(authSession._id));

  const id = event.context.params?.id;
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    throw createError({ statusCode: 400, statusMessage: 'Valid Slip ID is required' });
  }

  const slip = await SubcontractorExpense.findOne({
    _id: new mongoose.Types.ObjectId(String(id)),
    firmId: firmIdObj
  });

  if (!slip) {
    throw createError({ statusCode: 404, statusMessage: 'Site slip not found' });
  }

  // Ensure caller owns this slip or is Firm Admin/Owner
  const isOwner = slip.subcontractorUserId.toString() === userIdObj.toString();
  let isAdmin = false;
  if (!isOwner) {
    const currentUser = await User.findById(userIdObj).lean() as any;
    const currentAssignment = (currentUser?.firms || []).find((f: any) =>
      String(f.firm?._id || f.firm) === String(firmIdObj)
    );
    isAdmin = currentUser?.role === 'superadmin' || ['Owner', 'Admin'].includes(currentAssignment?.grade || '');
  }

  if (!isOwner && !isAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'You are not authorized to modify this slip' });
  }

  const body = await readBody(event) || {};
  const {
    expenseDate,
    category,
    amount,
    paymentMode,
    vendorOrPayee,
    notes,
    billOrSlipRef,
    projectId
  } = body;

  if (amount !== undefined) {
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      throw createError({ statusCode: 400, statusMessage: 'Amount must be greater than zero' });
    }
    slip.amount = numAmount;
  }

  if (category) {
    const validCategories: SubcontractorExpenseCategory[] = [
      'LABOR', 'MATERIAL', 'FUEL_DIESEL', 'MACHINERY_RENTAL', 'TRANSPORT', 'FOOD_WELFARE', 'REPAIRS', 'OTHER'
    ];
    if (!validCategories.includes(category)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid category' });
    }
    slip.category = category;
  }

  if (expenseDate) slip.expenseDate = expenseDate;
  if (paymentMode && ['CASH', 'UPI', 'BANK'].includes(paymentMode)) slip.paymentMode = paymentMode;
  if (vendorOrPayee !== undefined) slip.vendorOrPayee = String(vendorOrPayee).trim();
  if (notes !== undefined) slip.notes = String(notes).trim();
  if (billOrSlipRef !== undefined) slip.billOrSlipRef = String(billOrSlipRef).trim();
  if (projectId !== undefined) slip.projectId = projectId;

  await slip.save();

  return {
    success: true,
    message: 'Site slip updated successfully',
    slip
  };
});
