import mongoose from 'mongoose';
import BulkPayment from '../../../models/BulkPayment';
import BankAccount from '../../../models/BankAccount';
import VoucherSequence from '../../../models/VoucherSequence';
import { LedgerService } from '../../../utils/accounting/ledger.service';
import { requireAuthSession } from '../../../utils/auth';

async function getNextVoucherGroupId(firmId: mongoose.Types.ObjectId, session?: mongoose.ClientSession): Promise<number> {
  const seq = await VoucherSequence.findOneAndUpdate(
    { firmId },
    { $inc: { lastNo: 1 } },
    { returnDocument: 'after', upsert: true, session }
  );
  return seq.lastNo;
}

function generateVoucherNo(vtype: string, year: number, sequence: number): string {
  const prefixMap: Record<string, string> = { JOURNAL: 'JV', PAYMENT: 'PV', RECEIPT: 'RV', CONTRA: 'CV' };
  const prefix = prefixMap[vtype] || 'PV';
  return `${prefix}/${year}/${sequence.toString().padStart(4, '0')}`;
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const firmIdObj = new mongoose.Types.ObjectId(String(user.firm_id));
  const body = await readBody(event) || {};

  const { bankAccountId, paymentDate, chequeNo, defaultPaysys, narration, items } = body;

  if (!bankAccountId || !mongoose.Types.ObjectId.isValid(String(bankAccountId))) {
    throw createError({ statusCode: 400, statusMessage: 'Valid Bank Account is required' });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'At least one beneficiary payout row is required' });
  }

  const bankAccount = await BankAccount.findOne({
    _id: new mongoose.Types.ObjectId(String(bankAccountId)),
    $or: [{ firm_id: firmIdObj }, { firmId: firmIdObj as any }]
  }).lean();

  if (!bankAccount) {
    throw createError({ statusCode: 404, statusMessage: 'Selected Bank Account not found for this firm' });
  }

  const effectiveDate = paymentDate || new Date().toISOString().split('T')[0];
  const year = new Date(effectiveDate).getFullYear();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Generate unique batch number
    const count = await BulkPayment.countDocuments({ firmId: firmIdObj }).session(session);
    const batchNo = `BPAY/${year}/${(count + 1).toString().padStart(4, '0')}`;

    let totalAmount = 0;
    const processedItems = [];

    for (const rawItem of items) {
      const amount = Number(rawItem.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error(`Invalid amount ₹${rawItem.amount} for beneficiary ${rawItem.beneficiaryName || 'unnamed'}`);
      }
      totalAmount += amount;

      const voucherId = await getNextVoucherGroupId(firmIdObj, session);
      const voucherNo = generateVoucherNo('PAYMENT', year, voucherId);

      const itemNarration = rawItem.narration || narration || `Bulk payout via ${rawItem.paysysId || 'NEFT'} Chq: ${chequeNo || '-'}`;
      const fullLineNarration = `${itemNarration} | Beneficiary: ${rawItem.beneficiaryName || '-'} (A/C: ${rawItem.beneficiaryAccountNo || '-'}, IFSC: ${rawItem.beneficiaryIfsc || '-'}) | Batch: ${batchNo}`;

      const partyIdObj = rawItem.partyId && mongoose.Types.ObjectId.isValid(String(rawItem.partyId))
        ? new mongoose.Types.ObjectId(String(rawItem.partyId))
        : null;

      // 1-to-1 Double Entry Voucher:
      // Line 1: Debit Party/Expense Account
      // Line 2: Credit Firm Bank Account
      const ledgerEntries = [
        {
          firmId: firmIdObj,
          transactionDate: effectiveDate,
          accountHead: rawItem.accountHead || rawItem.beneficiaryName,
          accountType: rawItem.accountType || 'EXPENSE',
          debitAmount: amount,
          creditAmount: 0,
          narration: fullLineNarration,
          voucherGroupId: String(voucherId),
          voucherNo,
          voucherType: 'PAYMENT',
          partyId: partyIdObj,
          createdBy: user.username || user.email || 'system'
        },
        {
          firmId: firmIdObj,
          transactionDate: effectiveDate,
          accountHead: bankAccount.account_name,
          accountType: 'ASSET',
          debitAmount: 0,
          creditAmount: amount,
          bankAccountId: bankAccount._id as mongoose.Types.ObjectId,
          paymentMode: rawItem.paysysId || 'NEFT',
          narration: fullLineNarration,
          voucherGroupId: String(voucherId),
          voucherNo,
          voucherType: 'PAYMENT',
          createdBy: user.username || user.email || 'system'
        }
      ];

      await LedgerService.postVoucherToLedger(
        {
          firmId: firmIdObj,
          voucherId,
          voucherType: 'PAYMENT',
          voucherNo,
          transactionDate: effectiveDate,
          narration: fullLineNarration,
          entries: ledgerEntries,
          createdBy: user.username || user.email || 'system',
          session
        },
        user.username || user.email || 'system'
      );

      processedItems.push({
        accountHead: rawItem.accountHead || rawItem.beneficiaryName,
        accountType: rawItem.accountType || 'EXPENSE',
        partyId: partyIdObj,
        beneficiaryName: rawItem.beneficiaryName,
        beneficiaryAccountNo: String(rawItem.beneficiaryAccountNo || '').trim(),
        beneficiaryIfsc: String(rawItem.beneficiaryIfsc || '').trim().toUpperCase(),
        beneficiaryBankName: rawItem.beneficiaryBankName || '',
        beneficiaryBranch: rawItem.beneficiaryBranch || '',
        beneficiaryAccountType: rawItem.beneficiaryAccountType || '10',
        paysysId: rawItem.paysysId || (amount >= 200000 ? 'RTGS' : 'NEFT'),
        amount,
        narration: rawItem.narration || '',
        voucherGroupId: String(voucherId),
        voucherNo
      });
    }

    const bulkPaymentDoc = new BulkPayment({
      firmId: firmIdObj,
      batchNo,
      paymentDate: effectiveDate,
      bankAccountId: bankAccount._id,
      bankAccountName: bankAccount.account_name,
      bankAccountNumber: bankAccount.account_number,
      chequeNo: chequeNo || '',
      defaultPaysys: defaultPaysys || 'NEFT',
      totalAmount,
      totalCount: processedItems.length,
      status: 'POSTED',
      items: processedItems,
      narration: narration || '',
      createdBy: user.username || user.email || 'system'
    });

    await bulkPaymentDoc.save({ session });
    await session.commitTransaction();

    return {
      success: true,
      message: `Bulk payment batch ${batchNo} with ${processedItems.length} vouchers posted successfully`,
      data: bulkPaymentDoc
    };
  } catch (err: any) {
    await session.abortTransaction();
    console.error('Error posting bulk payment batch:', err);
    throw createError({ statusCode: 500, statusMessage: err.message || 'Failed to post bulk payment' });
  } finally {
    session.endSession();
  }
});
