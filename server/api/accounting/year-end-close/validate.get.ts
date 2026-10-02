import { requireAuthSession } from '../../../utils/auth';
import { FiscalYearClosingService } from '../../../utils/accounting/fiscal-year-closing.service';

// ─────────────────────────────────────────────────────────────────────────
// GET /api/accounting/year-end-close/validate
// Pre-close validation: returns a preview of what the year-end close
// will do, including P&L summary, trial balance parity check, and any
// blocking reasons.
//
// This is READ-ONLY and safe to call multiple times.
//
// Query params:
//   - financialYear (required): e.g. '2025-26'
// ─────────────────────────────────────────────────────────────────────────

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);

  if (!user.firm_id) {
    throw createError({ statusCode: 400, statusMessage: 'No firm associated with this user' });
  }

  const query = getQuery(event);
  const financialYear = query.financialYear ? String(query.financialYear) : null;

  if (!financialYear || !/^\d{4}-\d{2}$/.test(financialYear)) {
    throw createError({ statusCode: 400, statusMessage: 'financialYear is required (e.g. 2025-26)' });
  }

  try {
    const preview = await FiscalYearClosingService.previewClose(
      String(user.firm_id),
      financialYear
    );

    return {
      success: true,
      data: preview,
    };
  } catch (err: any) {
    console.error('[Year-End Validate Error]', err);
    throw createError({ statusCode: 500, statusMessage: err.message });
  }
});
