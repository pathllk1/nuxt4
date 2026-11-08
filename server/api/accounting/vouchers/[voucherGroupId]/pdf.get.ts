import { defineEventHandler, createError, setHeader } from 'h3';
import mongoose from 'mongoose';
import Ledger from '../../../../models/Ledger';
import Firm from '../../../../models/Firm';
import BankAccount from '../../../../models/BankAccount';
import { requireAuthSession } from '../../../../utils/auth';
import { connectDB } from '../../../../plugins/mongodb';
import { exportSingleVoucherToPdfBuffer } from '../../../../utils/accounting/pdf-export.utils';

export default defineEventHandler(async (event) => {
  try {
    await connectDB();
    const session = await requireAuthSession(event);
    const firmIdStr = String(session.firm_id);
    const firmIdObj = new mongoose.Types.ObjectId(firmIdStr);

    const voucherGroupId = event.context.params?.voucherGroupId;
    if (!voucherGroupId || !voucherGroupId.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'Voucher Group ID is required' });
    }

    const entries = await Ledger.find({
      $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }],
      voucherGroupId: voucherGroupId.trim()
    }).sort({ debitAmount: -1, creditAmount: 1 }).lean();

    if (!entries || entries.length === 0) {
      throw createError({ statusCode: 404, statusMessage: `Voucher "${voucherGroupId}" not found in General Ledger` });
    }

    const firm = await Firm.findById(firmIdObj).lean();

    const firstEntry = entries[0]!;
    const voucherType = (firstEntry.voucherType || 'JOURNAL').toUpperCase();
    const transactionDate = firstEntry.transactionDate;
    const voucherNo = firstEntry.voucherNo || voucherGroupId;
    const narration = firstEntry.narration || '';

    let totalDebit = 0;
    let totalCredit = 0;
    let paymentMode = firstEntry.paymentMode || '';
    let bankAccountDetails = '';

    // Check if any entry has a linked bank account
    const bankLeg = entries.find(e => e.bankAccountId);
    if (bankLeg && bankLeg.bankAccountId) {
      try {
        const bank = await BankAccount.findById(bankLeg.bankAccountId).lean();
        if (bank) {
          bankAccountDetails = `${bank.bank_name || bank.account_name} (${bank.account_number ? `A/C: ...${String(bank.account_number).slice(-4)}` : ''})`;
        }
      } catch {
        bankAccountDetails = bankLeg.accountHead;
      }
    } else {
      const liquidLeg = entries.find(e => ['BANK', 'CASH'].includes((e.accountType || '').toUpperCase()));
      if (liquidLeg) {
        bankAccountDetails = liquidLeg.accountHead;
      }
    }

    // Identify payment reference from entries or narration
    let refNo = '';
    const refLeg = entries.find(e => (e as any).refNo || (e as any).chequeNo);
    if (refLeg) {
      refNo = String((refLeg as any).refNo || (refLeg as any).chequeNo);
    } else if (narration) {
      const match = narration.match(/(?:chq|cheque|utr|ref|neft|rtgs|no)[\s.:#-]+([a-zA-Z0-9]+)/i);
      if (match && match[1]) {
        refNo = match[1];
      }
    }

    entries.forEach(e => {
      totalDebit += Number(e.debitAmount) || 0;
      totalCredit += Number(e.creditAmount) || 0;
      if (!paymentMode && e.paymentMode) paymentMode = e.paymentMode;
    });

    const mappedEntries = entries.map(e => ({
      accountHead: e.accountHead || 'General Account',
      accountType: e.accountType || 'GENERAL',
      accountCode: e.accountCode || '',
      debitAmount: Number(e.debitAmount) || 0,
      creditAmount: Number(e.creditAmount) || 0,
      narration: e.narration !== narration ? e.narration : undefined
    }));

    const pdfBuffer = await exportSingleVoucherToPdfBuffer({
      firm,
      voucherGroupId,
      voucherNo,
      voucherType,
      transactionDate,
      narration,
      entries: mappedEntries,
      totalDebit,
      totalCredit,
      paymentMode,
      refNo,
      bankAccountDetails,
      costCenter: 'Civil Infrastructure / Site General'
    });

    const safeFilename = `Voucher_${(voucherNo || voucherGroupId).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    setHeader(event, 'Content-Type', 'application/pdf');
    setHeader(event, 'Content-Disposition', `attachment; filename="${safeFilename}"`);

    return pdfBuffer;
  } catch (err: any) {
    if (err.statusCode) throw err;
    console.error('Error generating voucher PDF:', err);
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to generate voucher PDF: ${err.message || 'Internal Server Error'}`
    });
  }
});

