import { defineEventHandler, readBody, createError } from 'h3';
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
      period_id,
      amount,
      payment_date,
      payment_mode,
      bank_account_id,
      tds_mode,
      tds_rate,
      tds_amount,
      gross_amount,
      idempotency_key: idempotencyKey
    } = body;

    if (!period_id || typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 ||
      typeof payment_date !== 'string' || !isUuid(idempotencyKey)) {
      throw createError({ statusCode: 400, statusMessage: 'Period, positive amount, payment date, and UUID idempotency key are required.' });
    }
    getFinancialYearFromDate(payment_date);
    if (!['CASH', 'BANK', 'CHEQUE', 'UPI', 'NEFT', 'RTGS'].includes(payment_mode)) {
      throw createError({ statusCode: 400, statusMessage: 'A supported payment mode is required.' });
    }
    if (!['NONE', 'DEDUCT', 'GROSS_UP'].includes(tds_mode)) {
      throw createError({ statusCode: 400, statusMessage: 'A valid TDS mode is required.' });
    }
    if (payment_mode !== 'CASH' && !bank_account_id) {
      throw createError({ statusCode: 400, statusMessage: 'Bank account selection is required for non-cash payments.' });
    }

    const numTdsRate = tds_rate;
    const numTdsAmount = tds_amount;
    const numGrossAmount = gross_amount;
    if (
      typeof numTdsRate !== 'number' || !Number.isFinite(numTdsRate) || numTdsRate < 0 || numTdsRate > 20 ||
      typeof numTdsAmount !== 'number' || !Number.isFinite(numTdsAmount) || numTdsAmount < 0 ||
      typeof numGrossAmount !== 'number' || !Number.isFinite(numGrossAmount) || numGrossAmount <= 0 ||
      Math.abs(numGrossAmount - amount - numTdsAmount) > 0.01 ||
      (tds_mode === 'NONE' && (numTdsRate !== 0 || numTdsAmount !== 0)) ||
      (tds_mode !== 'NONE' && numTdsRate === 0)
    ) {
      throw createError({ statusCode: 400, statusMessage: 'The submitted gross, net, rate, and TDS values are inconsistent.' });
    }

    const stableVoucherGroupId = `ADV-${String(session.firm_id)}-${idempotencyKey}`;
    let postedVoucherGroupId: string | null = null;
    try {
      const advance = await sql.begin(async (tx: any) => {
        const [period] = await tx`
          SELECT p.*, l.id AS leader_id, l.name AS leader_name, l.pan AS leader_pan
          FROM labor_periods p
          JOIN labor_leaders l ON p.leader_id = l.id
          WHERE p.id = ${period_id} AND p.firm_id = ${String(session.firm_id)}
          FOR UPDATE
        `;
        if (!period) throw createError({ statusCode: 404, statusMessage: 'Work period not found in current firm.' });

        const [existing] = await tx`
          SELECT * FROM labor_advances
          WHERE firm_id = ${period.firm_id} AND idempotency_key = ${idempotencyKey}
          LIMIT 1
        `;
        const periodDeductionAmount = tds_mode === 'DEDUCT' ? numGrossAmount : amount;
        if (existing) {
          const matches = String(existing.period_id) === String(period_id) &&
            String(existing.ledger_voucher_group_id || '') === stableVoucherGroupId &&
            Number(existing.amount) === periodDeductionAmount &&
            dateValue(existing.payment_date) === payment_date &&
            String(existing.payment_mode) === payment_mode &&
            String(existing.paid_from_bank_account_id || '') === String(payment_mode === 'CASH' ? '' : bank_account_id) &&
            String(existing.tds_mode || '') === tds_mode &&
            Number(existing.tds_rate) === numTdsRate &&
            Number(existing.tds_amount) === numTdsAmount &&
            Number(existing.gross_amount) === numGrossAmount;
          if (!matches) {
            throw createError({ statusCode: 409, statusMessage: 'The idempotency key was already used with a different advance payload.' });
          }
          return { ...existing, isIdempotentReplay: true };
        }
        if (period.status === 'Settled') {
          throw createError({ statusCode: 409, statusMessage: 'Cannot add advances to a settled work period.' });
        }

        const sourcePaymentRef = `ADVANCE-${String(period.firm_id)}-${idempotencyKey}`;
        postedVoucherGroupId = await laborLedgerHelper.postLaborAdvance({
          firm_id: period.firm_id,
          amount,
          payment_date,
          bank_account_id: payment_mode === 'CASH' ? null : bank_account_id,
          payment_mode,
          leader_name: period.leader_name,
          created_by: String(session._id),
          tds_mode,
          tds_rate: numTdsRate,
          tds_amount: numTdsAmount,
          gross_amount: numGrossAmount,
          external_voucher_group_id: stableVoucherGroupId,
          source_payment_ref: sourcePaymentRef,
          deductee_id: String(period.leader_id),
          deductee_pan: String(period.leader_pan || '')
        });

        const [createdAdvance] = await tx`
          INSERT INTO labor_advances (
            firm_id, period_id, amount, payment_date, payment_mode, paid_from_bank_account_id,
            ledger_voucher_group_id, idempotency_key, tds_mode, tds_rate, tds_amount, gross_amount, leg_index
          ) VALUES (
            ${period.firm_id}, ${period_id}, ${periodDeductionAmount}, ${payment_date}, ${payment_mode},
            ${payment_mode === 'CASH' ? null : bank_account_id}, ${postedVoucherGroupId}, ${idempotencyKey},
            ${tds_mode}, ${numTdsRate}, ${numTdsAmount}, ${numGrossAmount}, 0
          )
          RETURNING *
        `;
        return createdAdvance;
      });
      return { success: true, data: advance, isIdempotentReplay: Boolean(advance?.isIdempotentReplay) };
    } catch (error: any) {
      if (!postedVoucherGroupId) throw error;
      throw createError({
        statusCode: 500,
        statusMessage: `Advance ledger voucher ${postedVoucherGroupId} is posted but its operational record was not confirmed. Retry with the same idempotency key ${idempotencyKey}; do not create a new request. Cause: ${error.statusMessage || error.message}`
      });
    }
  } catch (error: any) {
    console.error('Record labor advance error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Error recording labor advance'
    });
  }
});
