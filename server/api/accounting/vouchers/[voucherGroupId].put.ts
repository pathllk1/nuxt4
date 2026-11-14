import { defineEventHandler, createError, readBody } from 'h3';
import mongoose from 'mongoose';
import { UnifiedPostingService } from '../../../utils/accounting/unified-posting.service';
import { convertVoucherInputToLegs, mapLegacyVoucherType } from '../../../utils/accounting/posting-adapter';
import { resolveVoucherLiquidityAccount } from '../../../utils/accounting/voucher-liquidity-account';
import { requireAuthSession } from '../../../utils/auth';
import { getSql, connectPostgres } from '../../../utils/pg.config';
import { connectDB } from '../../../plugins/mongodb';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const voucherGroupId = event.context.params?.voucherGroupId;
  if (!voucherGroupId || !voucherGroupId.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Voucher Group ID is required' });
  }

  const body = (await readBody(event)) || {};
  const { vtype, vdate, narration = '', entries, mainAccount } = body;

  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Voucher must contain at least one entry' });
  }
  const parsedTransactionDate = typeof vdate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(vdate)
    ? new Date(`${vdate}T00:00:00.000Z`)
    : null;
  if (!parsedTransactionDate || Number.isNaN(parsedTransactionDate.getTime()) ||
      parsedTransactionDate.toISOString().slice(0, 10) !== vdate) {
    throw createError({ statusCode: 400, statusMessage: 'A valid transaction date is required in YYYY-MM-DD format' });
  }

  await connectDB();

  const firmIdObj = new mongoose.Types.ObjectId(String(user.firm_id));
  const transactionDate = vdate;
  const createdBy = user.username || user.email;
  if (!createdBy) {
    throw createError({ statusCode: 401, statusMessage: 'Authenticated user identity is required for voucher updates' });
  }

  if (entries.some((entry: any) => entry.laborPeriodId || body.laborPeriodId)) {
    throw createError({ statusCode: 409, statusMessage: 'Voucher updates cannot create or change labor-linked payments. Use the Labor module.' });
  }

  let sql = getSql();
  if (!sql) sql = await connectPostgres();
  if (!sql) {
    throw createError({ statusCode: 503, statusMessage: 'PostgreSQL labor records are unavailable; voucher update was not performed.' });
  }
  const [linkedAdvance] = await sql`
    SELECT id FROM labor_advances
    WHERE ledger_voucher_group_id = ${voucherGroupId.trim()} AND firm_id = ${String(user.firm_id)}
    LIMIT 1
  `;
  const [linkedSettlement] = await sql`
    SELECT s.id FROM labor_settlements s
    JOIN labor_periods p ON p.id = s.period_id
    WHERE s.ledger_voucher_group_id = ${voucherGroupId.trim()} AND p.firm_id = ${String(user.firm_id)}
    LIMIT 1
  `;
  if (linkedAdvance || linkedSettlement) {
    throw createError({
      statusCode: 409,
      statusMessage: 'This voucher is linked to labor records and cannot be edited here. Use the Labor module to make a source-evidenced change.'
    });
  }

  const executeUpdate = async (session?: mongoose.ClientSession) => {
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

    return await UnifiedPostingService.updateVoucher({
      firmId: firmIdObj,
      voucherGroupId: voucherGroupId.trim(),
      payload: {
        firmId: firmIdObj,
        voucherType: mappedType,
        transactionDate,
        narration,
        legs,
        createdBy,
        refType: 'VOUCHER',
      },
      session
    });
  };

  const session: mongoose.ClientSession = await mongoose.connection.startSession();
  let updateResult: any;

  try {
    session.startTransaction();
    updateResult = await executeUpdate(session);
    await session.commitTransaction();
  } catch (err: any) {
    if (session.inTransaction()) {
      try {
        await session.abortTransaction();
      } catch (abortErr: any) {
        console.error('[Vouchers Put] Transaction abort failed:', abortErr);
        throw createError({
          statusCode: 500,
          statusMessage: `Voucher update failed (${err.message}); transaction abort also failed (${abortErr.message}).`
        });
      }
    }
    console.error('[Vouchers Put] Error:', err);
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || err.message || 'Failed to update voucher'
    });
  } finally {
    await session.endSession();
  }

  return {
    success: true,
    message: `${vtype} voucher (${updateResult.voucherNo}) updated successfully`,
    data: {
      voucherGroupId: updateResult.voucherGroupId,
      voucherNo: updateResult.voucherNo,
      status: 'UPDATED'
    }
  };
});
