import { defineEventHandler, readBody, createError } from 'h3';
import mongoose from 'mongoose';
import { requireAuthSession } from '../../../utils/auth';
import { getSql, connectPostgres } from '../../../utils/pg.config';
import { laborLedgerHelper } from '../../../utils/labor-ledger-helper';
import { getFinancialYearFromDate } from '../../../utils/accounting/period-lock.service';

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const dateValue = (value: unknown): string =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    let sql = getSql();
    if (!sql) sql = await connectPostgres();
    if (!sql) throw createError({ statusCode: 503, statusMessage: 'PostgreSQL database connection is unavailable.' });

    const body = await readBody(event) || {};
    const {
      period_id: periodId,
      paid_amount: paidAmount,
      payment_date: paymentDate,
      payment_mode: paymentMode,
      bank_account_id: bankAccountId,
      adjustment_reason: adjustmentReason,
      idempotency_key: idempotencyKey
    } = body;

    if (!periodId || typeof paidAmount !== 'number' || !Number.isFinite(paidAmount) || paidAmount < 0 ||
      typeof paymentDate !== 'string' || !isUuid(idempotencyKey)) {
      throw createError({ statusCode: 400, statusMessage: 'Period, non-negative payout, payment date, and UUID idempotency key are required.' });
    }
    getFinancialYearFromDate(paymentDate);
    if (!['CASH', 'BANK', 'CHEQUE', 'UPI', 'NEFT', 'RTGS'].includes(paymentMode)) {
      throw createError({ statusCode: 400, statusMessage: 'A supported payment mode is required.' });
    }
    if (paidAmount > 0 && paymentMode !== 'CASH' && !bankAccountId) {
      throw createError({ statusCode: 400, statusMessage: 'Bank account selection is required for non-cash payments.' });
    }
    if (adjustmentReason !== undefined && adjustmentReason !== null && typeof adjustmentReason !== 'string') {
      throw createError({ statusCode: 400, statusMessage: 'Adjustment reason must be text.' });
    }

    const stableSettlementVoucherId = `SETTLE-${String(session.firm_id)}-${idempotencyKey}`;
    let postedVoucherGroupId: string | null = null;

    const settlement = await sql.begin(async (tx: any) => {
      const [period] = await tx`
        SELECT p.*, l.name AS leader_name
        FROM labor_periods p
        JOIN labor_leaders l ON p.leader_id = l.id
        WHERE p.id = ${periodId} AND p.firm_id = ${String(session.firm_id)}
        FOR UPDATE
      `;
      if (!period) throw createError({ statusCode: 404, statusMessage: 'Work period not found in current firm.' });

      const [wagesRow] = await tx`
        SELECT COALESCE(SUM(total_wages), 0) AS sum_wages
        FROM labor_workers WHERE period_id = ${periodId}
      `;
      const [expensesRow] = await tx`
        SELECT COALESCE(SUM(amount), 0) AS sum_expenses
        FROM labor_expenses WHERE period_id = ${periodId}
      `;
      const [advancesRow] = await tx`
        SELECT COALESCE(SUM(amount), 0) AS sum_advances
        FROM labor_advances WHERE period_id = ${periodId}
      `;
      const totalWages = Number(wagesRow.sum_wages);
      const totalExpenses = Number(expensesRow.sum_expenses);
      const totalAdvances = Number(advancesRow.sum_advances);
      if (![totalWages, totalExpenses, totalAdvances].every(Number.isFinite)) {
        throw createError({ statusCode: 500, statusMessage: 'Labor source totals are invalid; settlement was not posted.' });
      }
      const netPayable = totalWages + totalExpenses - totalAdvances;
      const expectedVoucherGroupId = totalWages + totalExpenses > 0 ||
        paidAmount > 0 ||
        (netPayable > 0 && Math.abs(netPayable - paidAmount) > 0.01)
        ? stableSettlementVoucherId
        : null;

      const [existing] = await tx`
        SELECT * FROM labor_settlements WHERE period_id = ${periodId} LIMIT 1
      `;
      if (existing) {
        const sameRequest = String(existing.idempotency_key || '') === idempotencyKey &&
          Number(existing.total_wages) === totalWages &&
          Number(existing.total_expenses) === totalExpenses &&
          Number(existing.total_advances) === totalAdvances &&
          Number(existing.net_payable) === netPayable &&
          Number(existing.paid_amount) === paidAmount &&
          String(existing.ledger_voucher_group_id || '') === String(expectedVoucherGroupId || '') &&
          dateValue(existing.payment_date) === paymentDate &&
          String(existing.payment_mode || '') === paymentMode &&
          String(existing.paid_from_bank_account_id || '') === String(paidAmount > 0 && paymentMode !== 'CASH' ? bankAccountId : '') &&
          String(existing.adjustment_reason || '') === String(adjustmentReason || '');
        if (!sameRequest) {
          throw createError({ statusCode: 409, statusMessage: 'This work period already has a settlement with a different request or payload.' });
        }
        return { ...existing, isIdempotentReplay: true };
      }
      if (period.status === 'Settled') {
        throw createError({ statusCode: 409, statusMessage: 'Work period is marked settled but has no matching settlement record.' });
      }

      postedVoucherGroupId = await laborLedgerHelper.postLaborSettlement({
        firm_id: period.firm_id,
        total_wages: totalWages,
        total_expenses: totalExpenses,
        total_advances: totalAdvances,
        net_payable: netPayable,
        paid_amount: paidAmount,
        adjustment_reason: adjustmentReason || null,
        payment_date: paymentDate,
        bank_account_id: paidAmount > 0 && paymentMode !== 'CASH' ? bankAccountId : null,
        payment_mode: paymentMode,
        leader_name: period.leader_name,
        created_by: String(session._id),
        external_voucher_group_id: stableSettlementVoucherId
      });

      const [createdSettlement] = await tx`
        INSERT INTO labor_settlements (
          period_id, total_wages, total_expenses, total_advances, net_payable, paid_amount,
          payment_date, payment_mode, paid_from_bank_account_id, ledger_voucher_group_id,
          idempotency_key, adjustment_reason
        ) VALUES (
          ${periodId}, ${totalWages}, ${totalExpenses}, ${totalAdvances}, ${netPayable}, ${paidAmount},
          ${paymentDate}, ${paymentMode}, ${paidAmount > 0 && paymentMode !== 'CASH' ? bankAccountId : null},
          ${postedVoucherGroupId}, ${idempotencyKey}, ${adjustmentReason || null}
        )
        RETURNING *
      `;
      await tx`
        UPDATE labor_periods
        SET status = 'Settled', updated_at = CURRENT_TIMESTAMP
        WHERE id = ${periodId} AND firm_id = ${String(session.firm_id)}
      `;
      return createdSettlement;
    }).catch((error: any) => {
      if (postedVoucherGroupId) {
        throw createError({
          statusCode: 500,
          statusMessage: `Settlement voucher ${postedVoucherGroupId} is posted but the operational settlement was not confirmed. Retry with idempotency key ${idempotencyKey}; do not create a new request. Cause: ${error.statusMessage || error.message}`
        });
      }
      throw error;
    });

    return { success: true, data: settlement, isIdempotentReplay: Boolean(settlement?.isIdempotentReplay) };
  } catch (error: any) {
    console.error('Record labor settlement error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Error settling labor period'
    });
  }
});
