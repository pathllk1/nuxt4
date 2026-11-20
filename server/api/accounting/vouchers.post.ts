import mongoose from 'mongoose';
import { UnifiedPostingService } from '../../utils/accounting/unified-posting.service';
import { convertVoucherInputToLegs, mapLegacyVoucherType } from '../../utils/accounting/posting-adapter';
import { resolveVoucherLiquidityAccount } from '../../utils/accounting/voucher-liquidity-account';
import { VoucherMutationSchema } from '../../utils/accounting/schemas/accounting-mutation.schema';
import { requireAuthSession } from '../../utils/auth';
import { connectDB } from '../../plugins/mongodb';

const databaseDate = (value: unknown) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const rawBody = (await readBody(event)) || {};
  const validationResult = VoucherMutationSchema.safeParse(rawBody);

  if (!validationResult.success) {
    const firstIssue = validationResult.error.issues[0];
    const path = firstIssue?.path?.join('.') || 'body';
    throw createError({
      statusCode: 400,
      statusMessage: `Validation Error on ${path}: ${firstIssue?.message || 'Invalid voucher payload'}`
    });
  }

  const { vtype, vdate, narration = '', entries, mainAccount, idempotencyKey } = validationResult.data;

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
  const isPayment = (vtype || '').toUpperCase() === 'PAYMENT';
  let laborSql: any = null;
  const laborEntries: Array<{ entry: any; legIndex: number; periodId: string | null; leaderId: string | null }> = [];

  if (isPayment) {
    const { getSql, connectPostgres } = await import('../../utils/pg.config');
    laborSql = getSql();
    if (!laborSql) laborSql = await connectPostgres();

    let pgLeadersMap = new Map<string, any>();
    if (laborSql) {
      try {
        const leaders = await laborSql`
          SELECT id, name
          FROM labor_leaders
          WHERE firm_id = ${String(user.firm_id)}
        `;
        for (const l of leaders) {
          pgLeadersMap.set(String(l.name).trim().toLowerCase(), l);
        }
      } catch (err: any) {
        console.warn('[Vouchers Post] Notice: Failed to fetch labor leaders from Postgres:', err?.message);
      }
    }

    for (let legIndex = 0; legIndex < entries.length; legIndex++) {
      const entry: any = entries[legIndex];
      const head = String(entry?.accountHead || '').trim();
      if (!head || /tds payable|tds borne by company/i.test(head)) continue;

      const explicitPeriodId = entry?.laborPeriodId || (rawBody as any)?.laborPeriodId || null;
      const matchedLeader = pgLeadersMap.get(head.toLowerCase());
      const isLaborHead = Boolean(
        explicitPeriodId ||
        matchedLeader ||
        String(entry?.accountType || '').toUpperCase() === 'LABOR_LEADER'
      );

      if (isLaborHead) {
        if (!laborSql) {
          throw createError({ statusCode: 503, statusMessage: 'PostgreSQL labor records are unavailable; voucher was not posted.' });
        }

        // Support unallocated advances without forcing artificial period creation
        const resolvedLeaderId = matchedLeader?.id || null;
        laborEntries.push({
          entry,
          legIndex,
          periodId: explicitPeriodId,
          leaderId: resolvedLeaderId
        });
      }
    }
  }

  for (const { entry, legIndex } of laborEntries) {
    const rawAmount = entry.amount !== undefined && entry.amount !== null ? entry.amount : entry.debitAmount;
    const amount = Number(rawAmount);
    if (rawAmount === undefined || rawAmount === null || rawAmount === '' || !Number.isFinite(amount) || amount <= 0) {
      throw createError({ statusCode: 400, statusMessage: `Labor-linked voucher entry ${legIndex + 1} must have a positive amount` });
    }
  }

  const executeSave = async (session?: mongoose.ClientSession) => {
    const liquidityAccount = await resolveVoucherLiquidityAccount(mainAccount, firmIdObj, session);

    const legs = convertVoucherInputToLegs({
      vtype,
      entries,
      mainAccount: liquidityAccount?.accountHead,
      mainAccountType: liquidityAccount?.accountType,
      bankAccountId: liquidityAccount?.bankAccountId ? String(liquidityAccount.bankAccountId) : undefined,
      narration: narration || '',
    });

    const mappedType = mapLegacyVoucherType(vtype);

    return await UnifiedPostingService.postVoucher(
      {
        firmId: firmIdObj,
        voucherType: mappedType,
        transactionDate,
        narration: narration || '',
        legs,
        createdBy,
        refType: 'VOUCHER',
        externalVoucherGroupId: `VOUCHER-${firmIdObj.toString()}-${idempotencyKey}`,
      },
      session
    );
  };

  const tdsPayableEntry: any = entries.find((entry: any) => /tds payable/i.test(String(entry?.accountHead || '')));
  const tdsBorneEntry: any = entries.find((entry: any) => /tds borne by company/i.test(String(entry?.accountHead || '')));
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
          if (!periodId) continue; // Unallocated advance has no period yet
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

        for (const { entry, legIndex, periodId, leaderId } of laborEntries) {
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
            const matches = String(existing.period_id || '') === String(periodId || '') &&
              String(existing.leader_id || '') === String(leaderId || '') &&
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
              firm_id, leader_id, period_id, amount, payment_date, payment_mode, paid_from_bank_account_id,
              ledger_voucher_group_id, idempotency_key, tds_mode, tds_rate, tds_amount, gross_amount, leg_index
            ) VALUES (
              ${String(user.firm_id)}, ${leaderId}, ${periodId || null}, ${periodAdvanceAmount}, ${transactionDate}, ${paymentMode},
              ${bankAccountId}, ${postResult.voucherGroupId}, ${requestKey}, ${tdsMode},
              ${tdsRate}, ${tdsAmount}, ${currentGrossAmount}, ${legIndex}
            )
          `;
        }
      });
    } catch (laborSyncError: any) {
      console.error('[Dual-DB Sync Failure] Labor advance write failed:', laborSyncError);
      let compensated = false;
      if (postResult?.voucherGroupId) {
        try {
          console.warn(`[Dual-DB Compensation] Reversing committed MongoDB voucher ${postResult.voucherGroupId} to avoid orphaned advance...`);
          await UnifiedPostingService.reverseVoucher({
            firmId: firmIdObj,
            originalVoucherGroupId: postResult.voucherGroupId,
            reason: `AUTO-ROLLBACK: Labor advance insert failed (${laborSyncError.message || 'Postgres error'})`,
            createdBy: 'system',
            reversalDate: transactionDate
          });
          compensated = true;
          console.info(`[Dual-DB Compensation] Successfully rolled back MongoDB voucher ${postResult.voucherGroupId}`);
        } catch (compErr: any) {
          console.error(`[CRITICAL Dual-DB Divergence] Failed to compensate MongoDB voucher ${postResult.voucherGroupId}:`, compErr);
        }
      }
      const statusNotice = compensated
        ? ` Committed GL voucher ${postResult.voucherGroupId} was automatically reversed to preserve cross-database atomicity.`
        : (postResult?.voucherGroupId ? ` WARNING: Voucher ${postResult.voucherGroupId} remained committed in GL.` : '');
      throw createError({
        statusCode: laborSyncError.statusCode || 500,
        statusMessage: `Labor advance synchronization failed.${statusNotice} Cause: ${laborSyncError.statusMessage || laborSyncError.message}`
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
