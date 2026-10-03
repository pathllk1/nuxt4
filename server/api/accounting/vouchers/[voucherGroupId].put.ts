import { defineEventHandler, createError, readBody } from 'h3';
import mongoose from 'mongoose';
import BankAccount from '../../../models/BankAccount';
import { UnifiedPostingService } from '../../../utils/accounting/unified-posting.service';
import { convertVoucherInputToLegs, mapLegacyVoucherType } from '../../../utils/accounting/posting-adapter';
import { requireAuthSession } from '../../../utils/auth';
import { getSql, connectPostgres } from '../../../utils/pg.config';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const voucherGroupId = event.context.params?.voucherGroupId;
  if (!voucherGroupId || !voucherGroupId.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Voucher Group ID is required' });
  }

  const body = (await readBody(event)) || {};
  const { vtype, vdate, narration = '', entries, mainAccount, summary } = body;

  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Voucher must contain at least one entry' });
  }

  const firmIdObj = new mongoose.Types.ObjectId(String(user.firm_id));
  const transactionDate = vdate || new Date().toISOString().split('T')[0];

  // 1. Guard against active labor settlement modification in PostgreSQL
  try {
    let sql = getSql();
    if (!sql) sql = await connectPostgres();
    if (sql) {
      const [activeSettlement] = await sql`
        SELECT id, period_id FROM labor_settlements WHERE ledger_voucher_group_id = ${voucherGroupId} LIMIT 1
      `;
      if (activeSettlement) {
        throw createError({
          statusCode: 400,
          statusMessage: 'This voucher is currently linked to an active Labor Settlement. Please use "Reopen / Unsettle Period" in the Labor module to safely edit it.'
        });
      }
    }
  } catch (pgErr: any) {
    if (pgErr.statusCode) throw pgErr;
    console.warn('PostgreSQL labor settlement guard warning:', pgErr);
  }

  // 2. Start Mongo transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let resolvedMainAccountName = mainAccount;
    let resolvedBankAccountId: mongoose.Types.ObjectId | null = null;

    if (mainAccount && mongoose.Types.ObjectId.isValid(mainAccount)) {
      const bankAccount = await BankAccount.findOne({
        _id: mainAccount,
        $or: [{ firm_id: firmIdObj }, { firmId: firmIdObj }]
      }).session(session).lean();

      if (bankAccount) {
        resolvedMainAccountName = bankAccount.account_name;
        resolvedBankAccountId = bankAccount._id as mongoose.Types.ObjectId;
      }
    }

    const legs = convertVoucherInputToLegs({
      vtype,
      entries,
      mainAccount: (mainAccount && summary) ? resolvedMainAccountName : (mainAccount || undefined),
      bankAccountId: resolvedBankAccountId,
      narration,
    });

    const mappedType = mapLegacyVoucherType(vtype);

    const updateResult = await UnifiedPostingService.updateVoucher({
      firmId: firmIdObj,
      voucherGroupId: voucherGroupId.trim(),
      payload: {
        firmId: firmIdObj,
        voucherType: mappedType,
        transactionDate,
        narration,
        legs,
        createdBy: user.username || user.email || 'system',
        refType: 'VOUCHER',
      },
      session
    });

    await session.commitTransaction();
    session.endSession();

    // 3. Cross-module sync: Update labor_advances in PostgreSQL
    try {
      let sql = getSql();
      if (!sql) sql = await connectPostgres();
      if (sql) {
        // Delete previous advances linked to this voucher
        await sql`
          DELETE FROM labor_advances
          WHERE ledger_voucher_group_id = ${voucherGroupId} AND firm_id = ${String(user.firm_id)}
        `;

        // If Payment voucher links to labor periods, re-insert
        if (vtype === 'PAYMENT') {
          for (const entry of entries) {
            const periodId = entry.laborPeriodId || body.laborPeriodId;
            if (periodId && (entry.amount > 0 || entry.debitAmount > 0)) {
              const amount = entry.amount || entry.debitAmount;
              const paidFromBankId = resolvedBankAccountId ? String(resolvedBankAccountId) : null;
              await sql`
                INSERT INTO labor_advances (
                  firm_id, period_id, amount, payment_date, paid_from_bank_account_id, ledger_voucher_group_id
                ) VALUES (
                  ${String(user.firm_id)}, ${periodId}, ${amount}, ${transactionDate}, ${paidFromBankId}, ${updateResult.voucherGroupId}
                )
              `;
            }
          }
        }
      }
    } catch (laborSyncErr) {
      console.warn('Cross-module labor advance sync notice during voucher update:', laborSyncErr);
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
  } catch (err: any) {
    await session.abortTransaction();
    session.endSession();
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || err.message || 'Failed to update voucher'
    });
  }
});
