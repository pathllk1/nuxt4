import { defineEventHandler, createError } from 'h3';
import { requireAuthSession } from '../../../../utils/auth';
import { getSql, connectPostgres } from '../../../../utils/pg.config';
import { UnifiedPostingService } from '../../../../utils/accounting/unified-posting.service';

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    let sql = getSql();
    if (!sql) sql = await connectPostgres();
    if (!sql) throw createError({ statusCode: 503, statusMessage: 'PostgreSQL database connection not ready' });

    const advanceId = event.context.params?.id;
    if (!advanceId) {
      throw createError({ statusCode: 400, statusMessage: 'Advance ID is required' });
    }

    const firmId = String(session.firm_id);

    // 1. Fetch the advance with period status
    const [advance] = await sql`
      SELECT la.*, lp.status as period_status, lp.leader_id, ll.name as leader_name
      FROM labor_advances la
      JOIN labor_periods lp ON la.period_id = lp.id
      JOIN labor_leaders ll ON lp.leader_id = ll.id
      WHERE la.id = ${advanceId} AND la.firm_id = ${firmId}
    `;

    if (!advance) {
      throw createError({ statusCode: 404, statusMessage: 'Labor advance record not found' });
    }

    if (advance.period_status === 'Settled') {
      throw createError({ statusCode: 400, statusMessage: 'Cannot revoke advances from a settled work period' });
    }

    // 2. If it was posted to the General Ledger with a real voucher group ID, reverse it in GL
    const voucherGroupId = advance.ledger_voucher_group_id;
    if (voucherGroupId && voucherGroupId !== 'ALLOCATED_FROM_LEDGER') {
      try {
        const mongoose = await import('mongoose');
        const sessionMongo = await mongoose.default.startSession();
        sessionMongo.startTransaction();
        try {
          await UnifiedPostingService.reverseVoucher({
            originalVoucherGroupId: voucherGroupId,
            firmId: firmId,
            reason: `Revocation of labor advance of ₹${advance.amount} for ${advance.leader_name}`,
            createdBy: String(session._id || 'system'),
            session: sessionMongo,
          });
          await sessionMongo.commitTransaction();
        } catch (revErr) {
          await sessionMongo.abortTransaction();
          console.error('Failed to reverse voucher for advance:', revErr);
          throw revErr;
        } finally {
          sessionMongo.endSession();
        }
      } catch (glErr: any) {
        console.error('GL reversal error on advance revoke:', glErr);
        throw createError({
          statusCode: 500,
          statusMessage: `Failed to reverse accounting voucher: ${glErr.message}`
        });
      }
    }

    // 3. Delete the advance row from PostgreSQL
    await sql`
      DELETE FROM labor_advances
      WHERE id = ${advanceId} AND firm_id = ${firmId}
    `;

    return {
      success: true,
      message: `Advance of ₹${Number(advance.amount).toLocaleString('en-IN')} revoked successfully`
    };
  } catch (error: any) {
    console.error('Delete labor advance error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error revoking labor advance'
    });
  }
});
