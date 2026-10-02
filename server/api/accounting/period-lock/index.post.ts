import { requireAuthSession } from '../../../utils/auth';
import { setPeriodLock } from '../../../utils/accounting/period-lock.service';

// ─────────────────────────────────────────────────────────────────────────
// POST /api/accounting/period-lock
// Sets or updates the period lock for a financial year.
// Admin-only operation — locks all transactions on or before lockDate.
//
// Body: { lockDate: 'YYYY-MM-DD', financialYear: '2025-26', reason: '...' }
// ─────────────────────────────────────────────────────────────────────────

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);

  if (!user.firm_id) {
    throw createError({ statusCode: 400, statusMessage: 'No firm associated with this user' });
  }

  // TODO: Add admin role check when role system is available
  // if (user.role !== 'ADMIN' && user.role !== 'OWNER') {
  //   throw createError({ statusCode: 403, statusMessage: 'Only admins can set period locks' });
  // }

  const body = await readBody(event) || {};
  const { lockDate, financialYear, reason } = body;

  if (!lockDate || !/^\d{4}-\d{2}-\d{2}$/.test(lockDate)) {
    throw createError({ statusCode: 400, statusMessage: 'lockDate is required (YYYY-MM-DD format)' });
  }

  if (!financialYear || !/^\d{4}-\d{2}$/.test(financialYear)) {
    throw createError({ statusCode: 400, statusMessage: 'financialYear is required (e.g. 2025-26)' });
  }

  try {
    const lock = await setPeriodLock({
      firmId: String(user.firm_id),
      lockDate,
      financialYear,
      reason: reason || `Period locked by ${user.username || user.email}`,
      lockedBy: user.username || user.email || 'system',
    });

    return {
      success: true,
      message: `Period locked up to ${lockDate} for FY ${financialYear}`,
      data: lock,
    };
  } catch (err: any) {
    throw createError({ statusCode: err.statusCode || 500, statusMessage: err.message });
  }
});
