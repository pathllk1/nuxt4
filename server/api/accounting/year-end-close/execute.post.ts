import { requireAuthSession } from '../../../utils/auth';
import { FiscalYearClosingService } from '../../../utils/accounting/fiscal-year-closing.service';

// ─────────────────────────────────────────────────────────────────────────
// POST /api/accounting/year-end-close/execute
// Executes the fiscal year-end closing wizard.
//
// THIS IS AN IRREVERSIBLE OPERATION. It:
//   1. Creates a CLOSING_ENTRY voucher zeroing all P&L accounts
//   2. Transfers net profit/loss to Reserves & Surplus
//   3. Generates OPENING_BALANCE vouchers for the next FY
//   4. Sets a hard period lock on the closed FY
//
// Body: { financialYear: '2025-26' }
//
// SAFETY:
//   - Idempotent: refuses to re-execute if already CLOSED or IN_PROGRESS
//   - Atomic: all steps are wrapped in a MongoDB transaction
//   - Rolls back closingStatus on failure
// ─────────────────────────────────────────────────────────────────────────

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);

  if (!user.firm_id) {
    throw createError({ statusCode: 400, statusMessage: 'No firm associated with this user' });
  }

  // TODO: Enforce admin/owner role check when role system is available
  // if (user.role !== 'ADMIN' && user.role !== 'OWNER') {
  //   throw createError({ statusCode: 403, statusMessage: 'Only admins can execute year-end close' });
  // }

  const body = await readBody(event) || {};
  const { financialYear } = body;

  if (!financialYear || !/^\d{4}-\d{2}$/.test(financialYear)) {
    throw createError({ statusCode: 400, statusMessage: 'financialYear is required (e.g. 2025-26)' });
  }

  try {
    // Run pre-validation first
    const preview = await FiscalYearClosingService.previewClose(
      String(user.firm_id),
      financialYear
    );

    if (!preview.canClose) {
      throw createError({
        statusCode: 422,
        statusMessage: `Cannot close FY ${financialYear}: ${preview.blockingReasons.join('; ')}`,
      });
    }

    // Execute the close
    const result = await FiscalYearClosingService.executeClose({
      firmId: String(user.firm_id),
      financialYear,
      closedBy: user.username || user.email || 'system',
    });

    return {
      success: true,
      message: `FY ${financialYear} closed successfully. Net ${result.profitType}: ₹${result.netProfit.toFixed(2)}`,
      data: result,
    };
  } catch (err: any) {
    console.error('[Year-End Close Execution Error]', err);
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.message || 'Year-end close failed',
    });
  }
});
