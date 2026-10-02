import mongoose from 'mongoose';
import BankAccount from '../../models/BankAccount';
import { UnifiedPostingService } from '../../utils/accounting/unified-posting.service';
import { convertVoucherInputToLegs, mapLegacyVoucherType } from '../../utils/accounting/posting-adapter';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const body = await readBody(event) || {};
  const { vtype, vdate, narration = '', entries, mainAccount, summary } = body;

  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Voucher must contain at least one entry' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const firmIdObj = new mongoose.Types.ObjectId(user.firm_id as string);
    const transactionDate = vdate || new Date().toISOString().split('T')[0];

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
      mainAccount: (mainAccount && summary) ? resolvedMainAccountName : undefined,
      bankAccountId: resolvedBankAccountId,
      narration,
    });

    const mappedType = mapLegacyVoucherType(vtype);

    const postResult = await UnifiedPostingService.postVoucher({
      firmId: firmIdObj,
      voucherType: mappedType,
      transactionDate,
      narration,
      legs,
      createdBy: user.username || user.email || 'system',
      refType: 'VOUCHER',
    }, session);

    await session.commitTransaction();
    session.endSession();

    // Cross-module sync: If payment voucher is linked to a Labor Period, record in labor_advances
    if (vtype === 'PAYMENT') {
      try {
        const { getSql, connectPostgres } = await import('../../utils/pg.config');
        let sql = getSql();
        if (!sql) sql = await connectPostgres();
        if (sql) {
          for (const entry of entries) {
            const periodId = entry.laborPeriodId || body.laborPeriodId;
            if (periodId && (entry.amount > 0 || entry.debitAmount > 0)) {
              const amount = entry.amount || entry.debitAmount;
              const paidFromBankId = resolvedBankAccountId ? String(resolvedBankAccountId) : null;
              await sql`
                INSERT INTO labor_advances (
                  firm_id, period_id, amount, payment_date, paid_from_bank_account_id, ledger_voucher_group_id
                ) VALUES (
                  ${String(user.firm_id)}, ${periodId}, ${amount}, ${transactionDate}, ${paidFromBankId}, ${postResult.voucherGroupId}
                )
              `;
            }
          }
        }
      } catch (laborSyncErr) {
        console.warn('Cross-module labor advance sync notice:', laborSyncErr);
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
  } catch (err: any) {
    await session.abortTransaction();
    session.endSession();
    throw createError({ statusCode: err.statusCode || 500, statusMessage: err.message });
  }
});
