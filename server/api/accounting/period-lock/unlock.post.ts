import { requireAuthSession } from '../../../utils/auth';
import { unlockPeriod } from '../../../utils/accounting/period-lock.service';

// ─────────────────────────────────────────────────────────────────────────
// POST /api/accounting/period-lock/unlock
// Temporarily unlocks a period (admin override).
// Cannot unlock a CLOSED financial year — that requires DBA intervention.
//
// Body: { financialYear: '2025-26', reason: 'Correction needed for ...' }
// ─────────────────────────────────────────────────────────────────────────

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);

  if (!user.firm_id) {
    throw createError({ statusCode: 400, statusMessage: 'No firm associated with this user' });
  }

  const body = await readBody(event) || {};
  const { financialYear, reason } = body;

  if (!financialYear) {
    throw createError({ statusCode: 400, statusMessage: 'financialYear is required' });
  }

  if (!reason || String(reason).trim().length < 10) {
    throw createError({ statusCode: 400, statusMessage: 'A detailed reason (min 10 chars) is required for audit trail' });
  }

  try {
    const result = await unlockPeriod({
      firmId: String(user.firm_id),
      financialYear,
      reason: String(reason).trim(),
      unlockedBy: user.username || user.email || 'system',
    });

    return {
      success: true,
      message: `Period for FY ${financialYear} has been unlocked`,
      data: result,
    };
  } catch (err: any) {
    throw createError({ statusCode: err.statusCode || 500, statusMessage: err.message });
  }
});
