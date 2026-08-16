import mongoose from 'mongoose';
import VoucherSequence from '../../models/VoucherSequence';
import BankAccount from '../../models/BankAccount';
import { LedgerService } from '../../utils/accounting/ledger.service';
import { SmartVoucherConverter } from '../../utils/accounting/smart-voucher-converter';
import { requireAuthSession } from '../../utils/auth';

async function getNextVoucherGroupId(firmId: mongoose.Types.ObjectId): Promise<number> {
  const seq = await VoucherSequence.findOneAndUpdate(
    { firmId },
    { $inc: { lastNo: 1 } },
    { returnDocument: 'after', upsert: true }
  );
  return seq.lastNo;
}

function generateVoucherNo(vtype: string, year: number, sequence: number): string {
  const prefixMap: any = { JOURNAL: 'JV', PAYMENT: 'PV', RECEIPT: 'RV', CONTRA: 'CV' };
  const prefix = prefixMap[vtype] || vtype.slice(0, 2);
  return `${prefix}/${year}/${sequence.toString().padStart(4, '0')}`;
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const body = await readBody(event) || {};
  const { vtype, vdate, narration, entries, mainAccount, summary } = body;

  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Voucher must contain at least one entry' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const firmIdObj = new mongoose.Types.ObjectId(user.firm_id as string);
    const voucherId = await getNextVoucherGroupId(firmIdObj);
    const voucherNo = generateVoucherNo(vtype, new Date().getFullYear(), voucherId);

    let ledgerEntries: any[];

    if (mainAccount && summary) {
      let resolvedMainAccountName = mainAccount;
      let resolvedBankAccountId: mongoose.Types.ObjectId | null = null;

      if (mongoose.Types.ObjectId.isValid(mainAccount)) {
        const bankAccount = await BankAccount.findOne({ _id: mainAccount, firm_id: firmIdObj }).session(session).lean();
        if (bankAccount) {
          resolvedMainAccountName = bankAccount.account_name;
          resolvedBankAccountId = bankAccount._id as mongoose.Types.ObjectId;
        }
      }

      ledgerEntries = SmartVoucherConverter.convertToLedgerEntries(
        firmIdObj,
        voucherId,
        voucherNo,
        vtype,
        vdate || new Date().toISOString().split('T')[0],
        resolvedMainAccountName,
        entries,
        narration,
        user.username || user.email || 'system'
      );

      if (resolvedBankAccountId) {
        for (const entry of ledgerEntries) {
          if (entry.accountHead === resolvedMainAccountName) {
            entry.bankAccountId = resolvedBankAccountId;
          }
        }
      }
    } else {
      ledgerEntries = entries.map((e: any) => ({
        firmId: firmIdObj,
        transactionDate: vdate || new Date().toISOString().split('T')[0],
        accountHead: e.accountHead,
        accountType: e.accountType || 'ASSET',
        debitAmount: e.debitAmount || 0,
        creditAmount: e.creditAmount || 0,
        narration: e.narration || narration,
        voucherGroupId: String(voucherId),
        voucherNo,
        voucherType: vtype,
        createdBy: user.username || user.email || 'system'
      }));
    }

    const voucherData = {
      firmId: firmIdObj,
      voucherId,
      voucherType: vtype,
      voucherNo,
      transactionDate: vdate || new Date().toISOString().split('T')[0],
      narration,
      entries: ledgerEntries,
      createdBy: user.username || user.email || 'system',
      session
    };

    await LedgerService.postVoucherToLedger(voucherData, user.username || user.email || 'system');

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
            if (periodId && entry.amount > 0) {
              const paymentDate = vdate || new Date().toISOString().split('T')[0];
              const paidFromBankId = (mainAccount && mongoose.Types.ObjectId.isValid(mainAccount)) ? String(mainAccount) : null;
              await sql`
                INSERT INTO labor_advances (
                  firm_id, period_id, amount, payment_date, paid_from_bank_account_id, ledger_voucher_group_id
                ) VALUES (
                  ${String(user.firm_id)}, ${periodId}, ${entry.amount}, ${paymentDate}, ${paidFromBankId}, ${String(voucherId)}
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
        voucherId,
        voucherNo,
        status: 'POSTED'
      }
    };
  } catch (err: any) {
    await session.abortTransaction();
    session.endSession();
    throw createError({ statusCode: err.statusCode || 500, statusMessage: err.message });
  }
});
