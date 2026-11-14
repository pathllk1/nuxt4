import { defineEventHandler, readBody, createError } from 'h3';
import mongoose from 'mongoose';
import Ledger from '../../../models/Ledger';
import Advance from '../../../models/Advance';
import MasterRoll from '../../../models/MasterRoll';
import User from '../../../models/User';
import { requireAuthSession } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event);
  const body = await readBody(event) || {};
  const entityId = typeof body.entityId === 'string' ? body.entityId.trim() : '';
  const toDate = typeof body.toDate === 'string' ? body.toDate.trim() : '';

  if (body.action !== 'RECONCILE') {
    throw createError({ statusCode: 400, statusMessage: 'A supported reconciliation action is required.' });
  }
  if (!mongoose.Types.ObjectId.isValid(entityId)) {
    throw createError({ statusCode: 400, statusMessage: 'A valid employee entity ID is required.' });
  }
  if (toDate) {
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(toDate);
    if (!dateMatch) throw createError({ statusCode: 400, statusMessage: 'Invalid toDate. Expected YYYY-MM-DD.' });
    const [, year, month, day] = dateMatch;
    const parsedDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (
      parsedDate.getUTCFullYear() !== Number(year) ||
      parsedDate.getUTCMonth() !== Number(month) - 1 ||
      parsedDate.getUTCDate() !== Number(day)
    ) {
      throw createError({ statusCode: 400, statusMessage: 'toDate must be a real calendar date.' });
    }
  }

  const firmIdObj = new mongoose.Types.ObjectId(String(session.firm_id));
  const employee = await MasterRoll.findOne({
    _id: new mongoose.Types.ObjectId(entityId),
    $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }]
  }, 'employee_name').lean();
  if (!employee) {
    throw createError({ statusCode: 404, statusMessage: 'Employee not found in current firm.' });
  }

  const currentUser = await User.findById(session._id).select('role firms').lean();
  const assignment = currentUser?.firms?.find((firm: any) => String(firm.firm?._id || firm.firm) === String(firmIdObj));
  if (currentUser?.role !== 'superadmin' && !['Owner', 'Admin', 'Manager'].includes(assignment?.grade || '')) {
    throw createError({ statusCode: 403, statusMessage: 'Owner, Admin, or Manager privileges are required.' });
  }

  const firmFilter = { $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }] };
  const ledgerFilter: Record<string, any> = {
    ...firmFilter,
    masterRollId: new mongoose.Types.ObjectId(entityId),
    accountHead: 'Advance to Employees',
    isReversed: { $ne: true }
  };
  const advanceFilter: Record<string, any> = {
    $or: [{ firm_id: firmIdObj }, { firmId: firmIdObj }],
    master_roll_id: new mongoose.Types.ObjectId(entityId)
  };
  if (toDate) {
    ledgerFilter.transactionDate = { $lte: toDate };
    advanceFilter.date = { $lte: toDate };
  }

  const [ledgerEntries, advances] = await Promise.all([
    Ledger.find(ledgerFilter, 'debitAmount creditAmount').lean(),
    Advance.find(advanceFilter, 'type amount').lean()
  ]);
  if (ledgerEntries.some(entry =>
    !Number.isFinite(Number(entry.debitAmount)) ||
    !Number.isFinite(Number(entry.creditAmount)) ||
    Number(entry.debitAmount) < 0 ||
    Number(entry.creditAmount) < 0
  )) {
    throw createError({ statusCode: 409, statusMessage: 'General-ledger advance records contain invalid amounts; reconciliation cannot be confirmed.' });
  }
  if (advances.some(advance =>
    !Number.isFinite(Number(advance.amount)) ||
    Number(advance.amount) < 0 ||
    !['ADVANCE', 'REPAYMENT'].includes(advance.type)
  )) {
    throw createError({ statusCode: 409, statusMessage: 'Sub-ledger advance records contain invalid amounts or types; reconciliation cannot be confirmed.' });
  }
  const glBalance = ledgerEntries.reduce(
    (total, entry) => total + Number(entry.debitAmount) - Number(entry.creditAmount),
    0
  );
  const slBalance = advances.reduce((total, advance) => {
    if (advance.type === 'ADVANCE') return total + Number(advance.amount);
    if (advance.type === 'REPAYMENT') return total - Number(advance.amount);
    throw createError({ statusCode: 409, statusMessage: `Unsupported advance record type "${advance.type}".` });
  }, 0);
  if (!Number.isFinite(glBalance) || !Number.isFinite(slBalance)) {
    throw createError({ statusCode: 409, statusMessage: 'Advance balances are not finite; reconciliation cannot be confirmed.' });
  }
  const variance = Math.round(Math.abs(glBalance - slBalance) * 100) / 100;

  if (variance >= 0.01) {
    throw createError({
      statusCode: 409,
      statusMessage: `Automatic repair is disabled because no authoritative source document identifies the missing posting. GL ₹${glBalance.toFixed(2)}, sub-ledger ₹${slBalance.toFixed(2)}, variance ₹${variance.toFixed(2)}. Reconcile against source evidence before posting an adjustment.`
    });
  }

  return {
    success: true,
    message: 'No variance detected. No accounting records were changed.',
    employeeName: employee.employee_name,
    glBalance,
    slBalance,
    variance: 0
  };
});
