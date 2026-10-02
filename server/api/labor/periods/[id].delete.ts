import { defineEventHandler, createError } from 'h3';
import { requireAuthSession } from '../../../utils/auth';
import { getSql, connectPostgres } from '../../../utils/pg.config';
import { UnifiedPostingService } from '../../../utils/accounting/unified-posting.service';

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    let sql = getSql();
    if (!sql) sql = await connectPostgres();
    if (!sql) throw createError({ statusCode: 503, statusMessage: 'PostgreSQL database connection not ready' });

    const id = event.context.params?.id;
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Period ID is required' });

    const firmId = String(session.firm_id);
    const [period] = await sql`
      SELECT p.*, l.name as leader_name 
      FROM labor_periods p
      LEFT JOIN labor_leaders l ON p.leader_id = l.id
      WHERE p.id = ${id} AND p.firm_id = ${firmId}
    `;
    if (!period) throw createError({ statusCode: 404, statusMessage: 'Work period not found' });

    if (period.status === 'Settled') {
      throw createError({ statusCode: 400, statusMessage: 'Cannot delete a settled work period. Please reopen/unsettle it first.' });
    }

    // 1. Fetch any advances with real accounting vouchers
    const advances = await sql`
      SELECT id, amount, ledger_voucher_group_id, payment_date
      FROM labor_advances
      WHERE period_id = ${id} AND firm_id = ${firmId}
    `;

    // 2. Reverse any real General Ledger vouchers so the books stay perfectly balanced
    if (advances && advances.length > 0) {
      const mongoose = await import('mongoose');
      for (const adv of advances) {
        if (adv.ledger_voucher_group_id && adv.ledger_voucher_group_id !== 'ALLOCATED_FROM_LEDGER') {
          const sessionMongo = await mongoose.default.startSession();
          sessionMongo.startTransaction();
          try {
            await UnifiedPostingService.reverseVoucher({
              originalVoucherGroupId: adv.ledger_voucher_group_id,
              firmId: firmId,
              reason: `Reversal: Labor advance of ₹${adv.amount} reversed due to deletion of work period for ${period.leader_name || 'Leader'}`,
              createdBy: String(session._id || 'system'),
              session: sessionMongo,
            });
            await sessionMongo.commitTransaction();
          } catch (revErr: any) {
            await sessionMongo.abortTransaction();
            console.error(`Failed to reverse voucher ${adv.ledger_voucher_group_id}:`, revErr);
          } finally {
            sessionMongo.endSession();
          }
        }
      }
    }

    // 3. Delete work period (PostgreSQL cascades child tables)
    await sql`DELETE FROM labor_periods WHERE id = ${id} AND firm_id = ${firmId}`;

    return { success: true, message: 'Work period and associated records deleted cleanly' };
  } catch (error: any) {
    console.error('Delete labor period error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error deleting labor period'
    });
  }
});
