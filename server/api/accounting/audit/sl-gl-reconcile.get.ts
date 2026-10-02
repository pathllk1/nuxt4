import mongoose from 'mongoose';
import { requireAuthSession } from '../../../utils/auth';
import { SLGLReconcilerService } from '../../../utils/accounting/sl-gl-reconciler.service';

// ─────────────────────────────────────────────────────────────────────────
// GET /api/accounting/audit/sl-gl-reconcile
// Runs the Sub-Ledger to General Ledger reconciliation diagnostic.
//
// Returns a full variance report covering:
//   - Accounts Receivable (Customer sub-ledger vs GL Sundry Debtors)
//   - Accounts Payable (Vendor sub-ledger vs GL Sundry Creditors)
//   - Bank Accounts (Bank register vs GL Bank heads)
//   - Labor Leaders (Labor sub-ledger vs GL Labor Leader heads)
//   - Count of untagged party vouchers (potential drift sources)
//
// Query params:
//   - toDate (optional): Cutoff date for the reconciliation (YYYY-MM-DD)
//
// This is a READ-ONLY diagnostic. It never modifies data.
// ─────────────────────────────────────────────────────────────────────────

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);

  if (!user.firm_id) {
    throw createError({ statusCode: 400, statusMessage: 'No firm associated with this user' });
  }

  const query = getQuery(event);
  const toDate = query.toDate ? String(query.toDate) : undefined;

  // Validate date format if provided
  if (toDate && !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    throw createError({ statusCode: 400, statusMessage: 'toDate must be in YYYY-MM-DD format' });
  }

  try {
    const report = await SLGLReconcilerService.runReconciliation(
      String(user.firm_id),
      toDate
    );

    return {
      success: true,
      data: report,
    };
  } catch (err: any) {
    console.error('[SL-GL Reconciliation Error]', err);
    throw createError({ statusCode: 500, statusMessage: err.message || 'Reconciliation failed' });
  }
});
