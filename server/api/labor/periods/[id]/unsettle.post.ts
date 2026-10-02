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

    if (period.status !== 'Settled') {
      throw createError({ statusCode: 400, statusMessage: 'Only settled work periods can be reopened' });
    }

    // 1. Fetch Settlement record
    const [settlement] = await sql`
      SELECT * FROM labor_settlements WHERE period_id = ${id}
    `;

    // 2. Reverse General Ledger settlement voucher if one was created
    if (settlement && settlement.ledger_voucher_group_id && !settlement.ledger_voucher_group_id.startsWith('SETTLED-NO-VOUCHER')) {
      const mongoose = await import('mongoose');
      const sessionMongo = await mongoose.default.startSession();
      sessionMongo.startTransaction();
      try {
        await UnifiedPostingService.reverseVoucher({
          originalVoucherGroupId: settlement.ledger_voucher_group_id,
          firmId: firmId,
          reason: `Reversal: Settlement for ${period.leader_name || 'Leader'} reversed to reopen work period`,
          createdBy: String(session._id || 'system'),
          session: sessionMongo,
        });
        await sessionMongo.commitTransaction();
      } catch (revErr: any) {
        await sessionMongo.abortTransaction();
        console.error('Failed to reverse settlement voucher:', revErr);
        throw createError({
          statusCode: 500,
          statusMessage: `Failed to reverse settlement accounting voucher: ${revErr.message}`
        });
      } finally {
        sessionMongo.endSession();
      }
    }

    // 3. Delete settlement record & set period status back to 'Open'
    await sql.begin(async (tx) => {
      await tx`DELETE FROM labor_settlements WHERE period_id = ${id}`;
      await tx`UPDATE labor_periods SET status = 'Open', updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`;
    });

    return {
      success: true,
      message: 'Work period reopened successfully. You can now edit attendance, advances, or dates.'
    };
  } catch (error: any) {
    console.error('Unsettle labor period error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error reopening labor period'
    });
  }
});
