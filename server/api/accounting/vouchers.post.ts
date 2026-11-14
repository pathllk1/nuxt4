import mongoose from 'mongoose';
import { UnifiedPostingService } from '../../utils/accounting/unified-posting.service';
import { convertVoucherInputToLegs, mapLegacyVoucherType } from '../../utils/accounting/posting-adapter';
import { resolveVoucherLiquidityAccount } from '../../utils/accounting/voucher-liquidity-account';
import { requireAuthSession } from '../../utils/auth';
import { connectDB } from '../../plugins/mongodb';

const databaseDate = (value: unknown) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const body = (await readBody(event)) || {};
  const { vtype, vdate, narration = '', entries, mainAccount, idempotencyKey } = body;

  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Voucher must contain at least one entry' });
  }
  if (typeof idempotencyKey !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    throw createError({ statusCode: 400, statusMessage: 'A valid voucher idempotency key is required' });
  }
  const parsedTransactionDate = typeof vdate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(vdate)
    ? new Date(`${vdate}T00:00:00.000Z`)
    : null;
  if (!parsedTransactionDate || Number.isNaN(parsedTransactionDate.getTime()) ||
      parsedTransactionDate.toISOString().slice(0, 10) !== vdate) {
    throw createError({ statusCode: 400, statusMessage: 'A valid transaction date is required in YYYY-MM-DD format' });
  }

  await connectDB();

  const firmIdObj = new mongoose.Types.ObjectId(user.firm_id as string);
  const createdBy = user.username || user.email;
  if (!createdBy) {
    throw createError({ statusCode: 401, statusMessage: 'Authenticated user identity is required for voucher posting' });
  }
  const transactionDate = vdate;
  if (entries.some((entry: any) => !entry || typeof entry !== 'object')) {
    throw createError({ statusCode: 400, statusMessage: 'Each voucher entry must be an object' });
  }
  const laborEntries = vtype === 'PAYMENT'
    ? entries.map((entry: any, legIndex: number) => ({ entry, legIndex, periodId: entry.laborPeriodId || body.laborPeriodId }))
      .filter(({ entry, periodId }: any) => periodId &&
        !/tds payable|tds borne by company/i.test(String(entry.accountHead || '')))
    : [];
  for (const { entry, legIndex } of laborEntries) {
    const rawAmount = entry.amount !== undefined && entry.amount !== null ? entry.amount : entry.debitAmount;
    const amount = Number(rawAmount);
    if (rawAmount === undefined || rawAmount === null || rawAmount === '' || !Number.isFinite(amount) || amount <= 0) {
      throw createError({ statusCode: 400, statusMessage: `Labor-linked voucher entry ${legIndex + 1} must have a positive amount` });
    }
  }
  let laborSql: any = null;
  if (laborEntries.length > 0) {
    const { getSql, connectPostgres } = await import('../../utils/pg.config');
    laborSql = getSql();
    if (!laborSql) laborSql = await connectPostgres();
    if (!laborSql) {
      throw createError({ statusCode: 503, statusMessage: 'PostgreSQL labor records are unavailable; voucher was not posted.' });
    }
  }

  const executeSave = async (session?: mongoose.ClientSession) => {
    const liquidityAccount = await resolveVoucherLiquidityAccount(mainAccount, firmIdObj, session);

    const legs = convertVoucherInputToLegs({
      vtype,
      entries,
      mainAccount: liquidityAccount?.accountHead,
      mainAccountType: liquidityAccount?.accountType,
      bankAccountId: liquidityAccount?.bankAccountId,
      narration,
    });

    const mappedType = mapLegacyVoucherType(vtype);

    return await UnifiedPostingService.postVoucher(
      {
        firmId: firmIdObj,
        voucherType: mappedType,
        transactionDate,
        narration,
        legs,
        createdBy,
        refType: 'VOUCHER',
        externalVoucherGroupId: `VOUCHER-${firmIdObj.toString()}-${idempotencyKey}`,
      },
      session
    );
  };

  const tdsPayableEntry = entries.find((entry: any) => /tds payable/i.test(String(entry.accountHead || '')));
  const tdsBorneEntry = entries.find((entry: any) => /tds borne by company/i.test(String(entry.accountHead || '')));
  const tdsBorneCount = entries.filter((entry: any) => /tds borne by company/i.test(String(entry.accountHead || ''))).length;
  const tdsMode = tdsPayableEntry ? (tdsBorneEntry ? 'GROSS_UP' : 'DEDUCT') : 'NONE';
  const tdsAmount = tdsPayableEntry
    ? Math.abs(Number(tdsPayableEntry.amount ?? tdsPayableEntry.creditAmount))
    : 0;
  const tdsRate = tdsPayableEntry ? Number(tdsPayableEntry.statutory?.tdsRate) : 0;
  const tdsGrossAmount = tdsPayableEntry ? Number(tdsPayableEntry.statutory?.grossAmount) : 0;
  if (laborEntries.length > 0 && tdsBorneCount > 0 && !tdsPayableEntry) {
    throw createError({ statusCode: 400, statusMessage: 'Labor-linked TDS borne by the company requires a matching TDS payable leg.' });
  }
  if (laborEntries.length > 0 && tdsPayableEntry) {
    const sourceRef = laborEntries.length === 1 ? laborEntries[0]!.entry.sourcePaymentRef : null;
    const tdsPayableCount = entries.filter((entry: any) => /tds payable/i.test(String(entry.accountHead || ''))).length;
    const laborBaseAmount = laborEntries.length === 1
      ? Number(laborEntries[0]!.entry.amount ?? laborEntries[0]!.entry.debitAmount)
      : Number.NaN;
    const expectedGrossAmount = tdsMode === 'GROSS_UP' ? laborBaseAmount + tdsAmount : laborBaseAmount;
    if (
      !sourceRef ||
      sourceRef !== tdsPayableEntry.sourcePaymentRef ||
      (tdsBorneEntry && tdsBorneEntry.sourcePaymentRef !== sourceRef) ||
      tdsPayableCount !== 1 ||
      tdsBorneCount > 1 ||
      !Number.isFinite(tdsAmount) || tdsAmount <= 0 ||
      !Number.isFinite(tdsRate) || tdsRate <= 0 ||
      tdsPayableEntry.statutory?.tdsSection !== '194C' ||
      Math.round(Number(tdsPayableEntry.statutory?.tdsAmount) * 100) !== Math.round(tdsAmount * 100) ||
      !Number.isFinite(tdsGrossAmount) ||
      Math.round(tdsGrossAmount * 100) !== Math.round(expectedGrossAmount * 100)
    ) {
      throw createError({ statusCode: 400, statusMessage: 'Labor-linked TDS requires one payment leg and an exact Section 194C source link.' });
    }
  }
  const postMongoVoucher = async () => {
    let session: mongoose.ClientSession | null = null;
    try {
      session = await mongoose.connection.startSession();
      session.startTransaction();
      const result = await executeSave(session);
      await session.commitTransaction();
      return result;
    } catch (error: any) {
      if (session?.inTransaction()) {
        try {
          await session.abortTransaction();
        } catch (abortError: any) {
          console.error('[Vouchers Post] Transaction abort failed:', abortError);
          throw new Error(`Voucher posting failed (${error.message}); transaction abort also failed (${abortError.message}).`);
        }
      }
      throw error;
    } finally {
      if (session) await session.endSession();
    }
  };

  let postResult: any;
  if (laborEntries.length > 0) {
    try {
      await laborSql.begin(async (tx: any) => {
        for (const { periodId } of laborEntries) {
          const [period] = await tx`
            SELECT id, status FROM labor_periods
            WHERE id = ${periodId} AND firm_id = ${String(user.firm_id)}
            FOR UPDATE
          `;
          if (!period) throw createError({ statusCode: 404, statusMessage: `Labor period "${periodId}" was not found in the current firm.` });
          if (period.status === 'Settled') {
            throw createError({ statusCode: 409, statusMessage: `Labor period "${periodId}" is settled and cannot receive advances.` });
          }
        }

        postResult = await postMongoVoucher();
        const bankAccountId = postResult.bankAccountId ? String(postResult.bankAccountId) : null;
        const paymentMode = bankAccountId ? 'BANK' : 'CASH';

        for (const { entry, legIndex, periodId } of laborEntries) {
          const baseAmount = Number(entry.amount ?? entry.debitAmount);
          if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
            throw new Error(`Labor advance leg ${legIndex} has an invalid amount.`);
          }
          const periodAdvanceAmount = baseAmount;
          const currentGrossAmount = tdsMode === 'GROSS_UP' ? baseAmount + tdsAmount : baseAmount;
          const requestKey = `${idempotencyKey}-${legIndex}`;
          const existingRows = await tx`
            SELECT * FROM labor_advances
            WHERE firm_id = ${String(user.firm_id)} AND idempotency_key = ${requestKey}
            LIMIT 1
          `;
          if (existingRows.length > 0) {
            const existing = existingRows[0];
            const matches = String(existing.period_id) === String(periodId) &&
              Math.round(Number(existing.amount) * 100) === Math.round(periodAdvanceAmount * 100) &&
              databaseDate(existing.payment_date) === transactionDate &&
              String(existing.payment_mode) === paymentMode &&
              String(existing.paid_from_bank_account_id || '') === String(bankAccountId || '') &&
              String(existing.ledger_voucher_group_id) === String(postResult.voucherGroupId) &&
              String(existing.tds_mode || '') === tdsMode &&
              Math.round(Number(existing.tds_amount) * 100) === Math.round(tdsAmount * 100) &&
              Math.round(Number(existing.gross_amount) * 100) === Math.round(currentGrossAmount * 100);
            if (!matches) {
              throw new Error(`[Labor Idempotency Conflict] Existing labor row does not match voucher ${postResult.voucherGroupId}, leg ${legIndex}.`);
            }
            continue;
          }

          await tx`
            INSERT INTO labor_advances (
              firm_id, period_id, amount, payment_date, payment_mode, paid_from_bank_account_id,
              ledger_voucher_group_id, idempotency_key, tds_mode, tds_rate, tds_amount, gross_amount, leg_index
            ) VALUES (
              ${String(user.firm_id)}, ${periodId}, ${periodAdvanceAmount}, ${transactionDate}, ${paymentMode},
              ${bankAccountId}, ${postResult.voucherGroupId}, ${requestKey}, ${tdsMode},
              ${tdsRate}, ${tdsAmount}, ${currentGrossAmount}, ${legIndex}
            )
          `;
        }
      });
    } catch (laborSyncError: any) {
      console.error('[Dual-DB Sync Failure] Labor advance write failed:', laborSyncError);
      const group = postResult?.voucherGroupId ? ` Voucher ${postResult.voucherGroupId} is committed in GL.` : '';
      throw createError({
        statusCode: laborSyncError.statusCode || 500,
        statusMessage: `${group} Labor synchronization was not confirmed. Retry with the same voucher request key ${idempotencyKey}. Cause: ${laborSyncError.statusMessage || laborSyncError.message}`
      });
    }
  } else {
    try {
      postResult = await postMongoVoucher();
    } catch (error: any) {
      console.error('[Vouchers Post] Error:', error);
      throw createError({
        statusCode: error.statusCode || 500,
        statusMessage: `Financial voucher posting failed: ${error.message}`
      });
    }
  }

  return {
    success: true,
    message: `${vtype} voucher created successfully`,
    data: {
      voucherId: postResult.voucherGroupId,
      voucherNo: postResult.voucherNo,
      status: 'POSTED'
    }
  };
});
