import mongoose from 'mongoose';
import { requireAuthSession } from '../../utils/auth';
import User from '../../models/User';
import SiteExpenseClaim, { SITE_EXPENSE_CATEGORY_MAP } from '../../models/SiteExpenseClaim';

/**
 * POST /api/field/expenses
 * Allows a Site Supervisor to submit a field expense claim.
 * Claims are saved with status PENDING — zero impact on GL.
 * Includes server-side enforcement of Income Tax Sec 40A(3) cash limit.
 */
export default defineEventHandler(async (event) => {
  const authSession = await requireAuthSession(event);
  const body = await readBody(event) || {};

  const firmIdObj = new mongoose.Types.ObjectId(String(authSession.firm_id));
  const userIdObj = new mongoose.Types.ObjectId(String(authSession._id));

  // Verify supervisor grade and get linked ledger head
  const userDoc = await User.findById(userIdObj).lean() as any;
  if (!userDoc) {
    throw createError({ statusCode: 401, statusMessage: 'User not found' });
  }

  const firmAssignment = (userDoc.firms || []).find((f: any) =>
    String(f.firm?._id || f.firm) === String(firmIdObj)
  );

  if (!firmAssignment || firmAssignment.grade !== 'Supervisor') {
    throw createError({ statusCode: 403, statusMessage: 'Only Site Supervisors can submit field expenses' });
  }

  const ledgerHead = firmAssignment.linkedLedgerHead;
  if (!ledgerHead) {
    throw createError({ statusCode: 400, statusMessage: 'Supervisor has no linked imprest ledger head' });
  }

  // Validate required fields
  const { category, amount, paymentMode, partyOrPayeeName, narration, expenseDate, projectId } = body;

  if (!category || !amount || !narration || !expenseDate) {
    throw createError({
      statusCode: 400,
      statusMessage: 'category, amount, narration, and expenseDate are required'
    });
  }

  const validCategories = Object.keys(SITE_EXPENSE_CATEGORY_MAP);
  if (!validCategories.includes(category)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid category. Must be one of: ${validCategories.join(', ')}`
    });
  }

  const numericAmount = Number(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Amount must be a positive number' });
  }

  // Date format validation (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) {
    throw createError({ statusCode: 400, statusMessage: 'expenseDate must be in YYYY-MM-DD format' });
  }

  const validPaymentModes = ['CASH', 'UPI', 'NEFT'];
  const resolvedPaymentMode = paymentMode || 'CASH';
  if (!validPaymentModes.includes(resolvedPaymentMode)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid paymentMode. Must be one of: ${validPaymentModes.join(', ')}`
    });
  }

  // ── Income Tax Sec 40A(3) Cash Limit Guard ──
  // Cash payment > ₹10,000 to a single party/vendor in a day is disallowed
  if (resolvedPaymentMode === 'CASH' && numericAmount > 10000) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Statutory Violation Prevented (Sec 40A(3)): Cash payment to a single vendor cannot exceed ₹10,000 in one day. Please split by bank/UPI or have Head Office issue a direct vendor payout.'
    });
  }

  // Resolve target COA head from category mapping
  const categoryMapping = SITE_EXPENSE_CATEGORY_MAP[category] || { accountName: 'Miscellaneous Site Expenses', accountType: 'INDIRECT_EXPENSE' };
  const targetAccountHead = categoryMapping.accountName;

  // Restrict to assigned projects if the supervisor has scoped projects
  if (firmAssignment.assignedProjectIds?.length > 0 && projectId) {
    if (!firmAssignment.assignedProjectIds.includes(projectId)) {
      throw createError({
        statusCode: 403,
        statusMessage: `You are not authorized for project "${projectId}"`
      });
    }
  }

  // Sanitize narration
  const sanitizedNarration = String(narration).trim().slice(0, 500);
  const sanitizedPayee = partyOrPayeeName ? String(partyOrPayeeName).trim().slice(0, 200) : undefined;

  // Create the expense claim in staging (PENDING)
  const claim = await SiteExpenseClaim.create({
    firmId: firmIdObj,
    supervisorId: userIdObj,
    supervisorName: userDoc.name,
    imprestAccountHead: ledgerHead,
    expenseDate,
    category,
    targetAccountHead,
    amount: numericAmount,
    paymentMode: resolvedPaymentMode,
    partyOrPayeeName: sanitizedPayee,
    narration: sanitizedNarration,
    projectId: projectId || undefined,
    status: 'PENDING',
  });

  return {
    success: true,
    statusCode: 201,
    message: 'Expense claim submitted for approval',
    claim: {
      id: claim._id,
      category,
      targetAccountHead,
      amount: numericAmount,
      paymentMode: resolvedPaymentMode,
      expenseDate,
      status: 'PENDING'
    }
  };
});
