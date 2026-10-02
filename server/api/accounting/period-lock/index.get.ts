import { requireAuthSession } from '../../../utils/auth';
import { getCurrentLockStatus } from '../../../utils/accounting/period-lock.service';

// ─────────────────────────────────────────────────────────────────────────
// GET /api/accounting/period-lock
// Returns the current period lock status for the authenticated user's firm.
// ─────────────────────────────────────────────────────────────────────────

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);

  if (!user.firm_id) {
    throw createError({ statusCode: 400, statusMessage: 'No firm associated with this user' });
  }

  const status = await getCurrentLockStatus(String(user.firm_id));

  return {
    success: true,
    data: status,
  };
});
