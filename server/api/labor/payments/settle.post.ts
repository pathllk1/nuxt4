import { defineEventHandler, readBody, createError } from 'h3';
import { requireAuthSession } from '../../../utils/auth';
import { getSql, connectPostgres } from '../../../utils/pg.config';
import { laborLedgerHelper } from '../../../utils/labor-ledger-helper';

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    let sql = getSql();
    if (!sql) sql = await connectPostgres();
    if (!sql) throw createError({ statusCode: 503, statusMessage: 'PostgreSQL database connection not ready' });

    const body = await readBody(event);
    const { period_id, paid_amount, payment_date, payment_mode = 'CASH', bank_account_id, adjustment_reason } = body;

    const numPaidAmount = Number(paid_amount);
    if (!period_id || numPaidAmount < 0 || !payment_date) {
      throw createError({ statusCode: 400, statusMessage: 'Valid period ID, payout amount, and payment date are required' });
    }

    if (payment_mode !== 'CASH' && !bank_account_id) {
      throw createError({ statusCode: 400, statusMessage: 'Bank account selection is required for non-cash payments' });
    }

    // Fetch Period & Leader
    const [period] = await sql`
      SELECT p.*, l.name as leader_name
      FROM labor_periods p
      JOIN labor_leaders l ON p.leader_id = l.id
      WHERE p.id = ${period_id} AND p.firm_id = ${String(session.firm_id)}
    `;

    if (!period) throw createError({ statusCode: 404, statusMessage: 'Work period not found' });
    if (period.status === 'Settled') throw createError({ statusCode: 400, statusMessage: 'This work period is already settled' });

    // 0. Preflight PostgreSQL check before posting any GL voucher (F-06)
    const [existingSettlePreflight] = await sql`
      SELECT * FROM labor_settlements
      WHERE period_id = ${period_id}
      LIMIT 1
    `;
    if (existingSettlePreflight) {
      const existingPaid = Number(existingSettlePreflight.paid_amount) || 0;
      if (Math.abs(existingPaid - numPaidAmount) > 0.01) {
        throw createError({
          statusCode: 409,
          statusMessage: `Idempotency Conflict: Work period is already settled with paid amount ₹${existingPaid} (requested ₹${numPaidAmount}).`
        });
      }
      return { success: true, data: existingSettlePreflight, isIdempotentReplay: true };
    }

    // Calculate totals from PostgreSQL
    const [wagesRow] = await sql`
      SELECT COALESCE(SUM(total_wages), 0) as sum_wages FROM labor_workers WHERE period_id = ${period_id}
    `;
    const [expensesRow] = await sql`
      SELECT COALESCE(SUM(amount), 0) as sum_expenses FROM labor_expenses WHERE period_id = ${period_id}
    `;
    const [advancesRow] = await sql`
      SELECT COALESCE(SUM(amount), 0) as sum_advances FROM labor_advances WHERE period_id = ${period_id}
    `;

    const totalWages = Number(wagesRow?.sum_wages || 0);
    const totalExpenses = Number(expensesRow?.sum_expenses || 0);
    const totalAdvances = Number(advancesRow?.sum_advances || 0);
    const netPayable = totalWages + totalExpenses - totalAdvances;

    // Stable settlement voucherGroupId to guarantee cross-retry idempotency (F-06)
    const idempotencyKey = body.idempotency_key || body.idempotencyKey || null;
    const stableSettlementVoucherId = idempotencyKey
      ? `SETTLE-${period.firm_id}-${idempotencyKey}`
      : `SETTLE-${period.firm_id}-${period_id}`;

    // 1. Post Settlement to MongoDB Ledger
    const voucherGroupId = await laborLedgerHelper.postLaborSettlement({
      firm_id: period.firm_id,
      total_wages: totalWages,
      total_expenses: totalExpenses,
      total_advances: totalAdvances,
      net_payable: netPayable,
      paid_amount: numPaidAmount,
      adjustment_reason: adjustment_reason,
      payment_date: payment_date,
      bank_account_id: payment_mode === 'CASH' ? null : bank_account_id,
      payment_mode: payment_mode,
      leader_name: period.leader_name,
      created_by: String(session._id),
      external_voucher_group_id: stableSettlementVoucherId
    });

    // 2. Ensure schema has newly added columns before inserting
    try {
      await sql`
        ALTER TABLE labor_settlements 
        ADD COLUMN IF NOT EXISTS paid_from_bank_account_id VARCHAR(24),
        ADD COLUMN IF NOT EXISTS ledger_voucher_group_id VARCHAR(100),
        ADD COLUMN IF NOT EXISTS adjustment_reason VARCHAR(255);
      `;
    } catch (_) {}

    // Insert into PostgreSQL labor_settlements & update labor_periods status (idempotent write)
    let settlement: any = null;
    try {
      await sql.begin(async (tx) => {
        const existingSettle = await tx`
          SELECT * FROM labor_settlements
          WHERE period_id = ${period_id}
          LIMIT 1
        `;
        if (existingSettle && existingSettle.length > 0) {
          settlement = existingSettle[0];
          // If a new voucher was posted during this request but PostgreSQL already had a committed settlement,
          // void/reverse the redundant MongoDB voucher so no orphan voucher remains (F-06)
          if (voucherGroupId && voucherGroupId !== settlement.ledger_voucher_group_id && !voucherGroupId.startsWith('SETTLED-NO-VOUCHER')) {
            try {
              const mongoose = (await import('mongoose')).default;
              const Ledger = (await import('../../../models/Ledger')).default;
              const firmOid = mongoose.Types.ObjectId.isValid(String(period.firm_id))
                ? new mongoose.Types.ObjectId(String(period.firm_id))
                : period.firm_id;
              await Ledger.updateMany(
                { voucherGroupId, $or: [{ firmId: firmOid }, { firm_id: firmOid }] },
                { $set: { isReversed: true, reversedAt: new Date(), reversalReason: 'Voided duplicate voucher from concurrent settlement race' } }
              );
            } catch (vErr: any) {
              console.error('[Labor Settlement - F-06] Critical: Failed to reverse redundant voucher during settlement race:', vErr?.message);
              throw createError({
                statusCode: 500,
                statusMessage: `Failed to reverse redundant GL voucher "${voucherGroupId}" during concurrent settlement race: ${vErr?.message}`
              });
            }
          }

          // Assert payload equality on idempotent retry (F-06)
          const existingPaid = Number(settlement.paid_amount) || 0;
          if (Math.abs(existingPaid - numPaidAmount) > 0.01) {
            throw createError({
              statusCode: 409,
              statusMessage: `Idempotency Conflict: Existing settlement record paid amount ₹${existingPaid} does not match requested amount ₹${numPaidAmount}.`
            });
          }
        } else {
          [settlement] = await tx`
            INSERT INTO labor_settlements (
              period_id, total_wages, total_expenses, total_advances, net_payable, paid_amount, payment_date, paid_from_bank_account_id, ledger_voucher_group_id, adjustment_reason
            ) VALUES (
              ${period_id}, ${totalWages}, ${totalExpenses}, ${totalAdvances}, ${netPayable}, ${numPaidAmount}, ${payment_date}, ${payment_mode === 'CASH' ? null : bank_account_id}, ${voucherGroupId}, ${adjustment_reason || null}
            )
            RETURNING *
          `;
        }

        await tx`
          UPDATE labor_periods SET status = 'Settled', updated_at = CURRENT_TIMESTAMP WHERE id = ${period_id}
        `;
      });
    } catch (pgError: any) {
      // If Postgres fails, reverse the dangling MongoDB voucher with strict tenant scoping (F-07)
      let compSuccess = false;
      let compErrorMsg = '';
      if (voucherGroupId && !voucherGroupId.startsWith('SETTLED-NO-VOUCHER')) {
        try {
          const mongoose = (await import('mongoose')).default;
          const Ledger = (await import('../../../models/Ledger')).default;
          const firmOid = mongoose.Types.ObjectId.isValid(String(period.firm_id))
            ? new mongoose.Types.ObjectId(String(period.firm_id))
            : period.firm_id;
          const compResult = await Ledger.updateMany(
            {
              voucherGroupId,
              $or: [{ firmId: firmOid }, { firm_id: firmOid }]
            },
            {
              $set: {
                isReversed: true,
                reversedAt: new Date(),
                reversalReason: `Compensating cancellation: PostgreSQL labor settlement write failed (${pgError.message || 'Error'})`
              }
            }
          );
          compSuccess = (compResult?.modifiedCount || 0) > 0;
        } catch (compErr: any) {
          compErrorMsg = compErr.message;
          console.error('[Dual-DB Compensation Failure] Could not reverse orphaned settlement voucher:', compErr.message);
        }
      }

      if (voucherGroupId && !voucherGroupId.startsWith('SETTLED-NO-VOUCHER') && !compSuccess) {
        throw createError({
          statusCode: 500,
          statusMessage: `PostgreSQL labor settlement write failed: ${pgError.message || 'Database error'}. WARNING: Compensating void of MongoDB voucher "${voucherGroupId}" could not be confirmed (${compErrorMsg || '0 documents updated'}). Manual reconciliation required.`
        });
      }
      throw pgError;
    }

    return { success: true, data: settlement };
  } catch (error: any) {
    console.error('Record labor settlement error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error settling labor period'
    });
  }
});
