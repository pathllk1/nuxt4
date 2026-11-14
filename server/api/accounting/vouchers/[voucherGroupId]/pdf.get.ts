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

    const targetId = voucherGroupId.trim();

    // 1. Fetch active ledger entries for this voucher (strictly excluding reversed/superseded legs)
    let entries = await Ledger.find({
      $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }],
      $and: [
        {
          $or: [
            { voucherGroupId: targetId },
            { voucherNo: targetId }
          ]
        },
        { isReversed: { $ne: true } }
      ]
    }).sort({ legIndex: 1, createdAt: 1 }).lean();

    // 2. Fuzzy fallback if targetId had dash/slash variations (e.g. JV/2026-27/0010 vs JV-2026-27-000010)
    if (!entries || entries.length === 0) {
      const altTarget = targetId.replace(/\//g, '-');
      entries = await Ledger.find({
        $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }],
        $and: [
          {
            $or: [
              { voucherGroupId: altTarget },
              { voucherNo: altTarget }
            ]
          },
          { isReversed: { $ne: true } }
        ]
      }).sort({ legIndex: 1, createdAt: 1 }).lean();
    }

    let isVoided = false;

    // 3. If no active legs found at all, check if the voucher was voided/cancelled
    if (!entries || entries.length === 0) {
      const allReversed = await Ledger.find({
        $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }],
        $and: [
          {
            $or: [
              { voucherGroupId: targetId },
              { voucherNo: targetId }
            ]
          }
        ]
      }).sort({ legIndex: 1, createdAt: 1 }).lean();

      if (!allReversed || allReversed.length === 0) {
        throw createError({ statusCode: 404, statusMessage: `Voucher "${voucherGroupId}" not found in General Ledger` });
      }

      isVoided = true;
      // Isolate the latest generation of reversed legs to avoid printing multiple historical revisions
      const latestReversedAt = allReversed.reduce((latest, e) => {
        const d = e.reversedAt ? new Date(e.reversedAt).getTime() : 0;
        return d > latest ? d : latest;
      }, 0);

      if (latestReversedAt > 0) {
        const latestBatch = allReversed.filter(e => e.reversedAt && Math.abs(new Date(e.reversedAt).getTime() - latestReversedAt) < 2000);
        entries = latestBatch.length > 0 ? latestBatch : allReversed;
      } else {
        entries = allReversed;
      }
    }

    // Sort entries: Debits first (by legIndex), then Credits (by legIndex)
    const debitLegs = entries.filter(e => (Number(e.debitAmount) || 0) > 0);
    const creditLegs = entries.filter(e => (Number(e.debitAmount) || 0) === 0);
    const orderedEntries = [...debitLegs, ...creditLegs];

    const firm = await Firm.findById(firmIdObj).lean();

    const firstEntry = orderedEntries[0]!;
    const voucherType = (firstEntry.voucherType || 'JOURNAL').toUpperCase();
    const transactionDate = firstEntry.transactionDate;
    const voucherNo = firstEntry.voucherNo || voucherGroupId;
    const narration = firstEntry.narration || '';

    let totalDebit = 0;
    let totalCredit = 0;
    let paymentMode = firstEntry.paymentMode || '';
    let bankAccountDetails = '';

    // Check if any entry has a linked bank account
    const bankLeg = orderedEntries.find(e => e.bankAccountId);
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
      const liquidLeg = orderedEntries.find(e => ['BANK', 'CASH'].includes((e.accountType || '').toUpperCase()));
      if (liquidLeg) {
        bankAccountDetails = liquidLeg.accountHead;
      }
    }

    // Identify payment reference from entries or narration
    let refNo = '';
    const refLeg = orderedEntries.find(e => (e as any).refNo || (e as any).chequeNo);
    if (refLeg) {
      refNo = String((refLeg as any).refNo || (refLeg as any).chequeNo);
    } else if (narration) {
      const match = narration.match(/(?:chq|cheque|utr|ref|neft|rtgs|no)[\s.:#-]+([a-zA-Z0-9]+)/i);
      if (match && match[1]) {
        refNo = match[1];
      }
    }

    orderedEntries.forEach(e => {
      totalDebit += Number(e.debitAmount) || 0;
      totalCredit += Number(e.creditAmount) || 0;
      if (!paymentMode && e.paymentMode) paymentMode = e.paymentMode;
    });

    const mappedEntries = orderedEntries.map(e => ({
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
      costCenter: 'Civil Infrastructure / Site General',
      isVoided
    });

    const query = getQuery(event);
    const disposition = (query.download === 'true' || query.download === '1') ? 'attachment' : 'inline';
    const safeFilename = `Voucher_${(voucherNo || voucherGroupId).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    setHeader(event, 'Content-Type', 'application/pdf');
    setHeader(event, 'Content-Disposition', `${disposition}; filename="${safeFilename}"`);

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

