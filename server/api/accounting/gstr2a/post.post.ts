import { defineEventHandler, readBody, createError } from 'h3';
import mongoose from 'mongoose';
import Party from '../../../models/Party';
import Bill from '../../../models/Bill';
import ChartOfAccounts from '../../../models/ChartOfAccounts';
import { LedgerService } from '../../../utils/accounting/ledger.service';
import { resolveLedgerPostingAccount } from '../../../utils/accounting/ledger-account-resolver';
import { getNextBillNumber, getNextVoucherNumber } from '../../../utils/accounting/bill-utils';
import { resolvePartyLocation, resolveFirmLocation } from '../../../utils/accounting/bill-shared';
import { requireAuthSession } from '../../../utils/auth';
import { connectDB } from '../../../plugins/mongodb';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const body = await readBody(event) || {};
  const { invoices, purchaseLedgerId, purchaseLedgerHead, firmGstin } = body;

  if (!Array.isArray(invoices) || !invoices.length) {
    throw createError({ statusCode: 400, statusMessage: 'No invoices selected for posting.' });
  }

  await connectDB();

  const firmIdObj = new mongoose.Types.ObjectId(String(user.firm_id));
  const username = user.username || user.email || 'system';

  // 1. Resolve Default Purchase Ledger Account
  const targetPurchaseHead = (purchaseLedgerHead || 'Purchases').trim();
  const purchaseAccount = await resolveLedgerPostingAccount({
    firmId: firmIdObj,
    accountHead: targetPurchaseHead,
    fallbackType: 'EXPENSE'
  });

  let purchaseLedgerAccountId: mongoose.Types.ObjectId | undefined;
  if (purchaseLedgerId && mongoose.Types.ObjectId.isValid(purchaseLedgerId)) {
    purchaseLedgerAccountId = new mongoose.Types.ObjectId(purchaseLedgerId);
  } else {
    const coaDoc = await ChartOfAccounts.findOne({
      firm_id: firmIdObj,
      account_name: purchaseAccount.accountHead
    }).select('_id').lean();
    if (coaDoc) {
      purchaseLedgerAccountId = coaDoc._id as mongoose.Types.ObjectId;
    }
  }

  // 2. Resolve Firm Location
  const normFirmGstin = firmGstin ? String(firmGstin).trim().toUpperCase() : undefined;
  const { firmLoc, firmStateCode } = await resolveFirmLocation(firmIdObj, normFirmGstin);

  const results: Array<{
    invoiceNo: string;
    gstin: string;
    success: boolean;
    billNo?: string;
    billId?: string;
    partyName?: string;
    error?: string;
  }> = [];

  let successCount = 0;
  let failureCount = 0;

  // 3. Process each invoice sequentially
  for (const inv of invoices) {
    try {
      const normGstin = (inv.gstin || '').toUpperCase().trim();
      const normInvNo = (inv.invoiceNo || '').trim();

      if (!normGstin || !normInvNo) {
        throw new Error('Missing GSTIN or Invoice Number');
      }

      // Step A: Ensure Party Master Record
      const pan = inv.partyPan || normGstin.substring(2, 12);
      const stateCode = inv.partyStateCode || normGstin.substring(0, 2);
      let partyDoc: any = null;

      if (inv.partyId && mongoose.Types.ObjectId.isValid(inv.partyId)) {
        partyDoc = await Party.findOne({ _id: new mongoose.Types.ObjectId(inv.partyId), firmId: firmIdObj }).lean();
      }

      if (!partyDoc) {
        // 1. Find existing party by GSTIN (primary or secondary location)
        partyDoc = await Party.findOne({
          firmId: firmIdObj,
          $or: [
            { gstin: normGstin },
            { 'gstLocations.gstin': normGstin }
          ]
        }).lean();
      }

      if (!partyDoc && pan && pan.length === 10) {
        // 2. Find existing party by PAN (multi-state enterprise)
        partyDoc = await Party.findOne({
          firmId: firmIdObj,
          pan: pan.toUpperCase()
        }).lean();
      }

      if (!partyDoc) {
        // 3. Find by Name
        const partyNameCandidate = (inv.partyName || `Vendor ${normGstin}`).trim();
        partyDoc = await Party.findOne({
          firmId: firmIdObj,
          name: partyNameCandidate
        }).lean();
      }

      if (partyDoc) {
        // If party already exists but does not have this branch GSTIN in gstLocations, append it
        const hasLoc = partyDoc.gstin === normGstin ||
          (Array.isArray(partyDoc.gstLocations) && partyDoc.gstLocations.some((l: any) => l.gstin === normGstin));
        
        if (!hasLoc) {
          await Party.updateOne(
            { _id: partyDoc._id },
            {
              $push: {
                gstLocations: {
                  gstin: normGstin,
                  stateCode,
                  state: inv.partyState || '',
                  address: inv.partyAddress || '',
                  pincode: inv.partyPin || '',
                  isPrimary: false
                }
              }
            }
          );
        }
      } else {
        // Create new Party in Party Master
        const partyNameCandidate = (inv.partyName || `Vendor ${normGstin}`).trim();
        const newParty = await Party.create({
          firmId: firmIdObj,
          name: partyNameCandidate,
          gstin: normGstin,
          state: inv.partyState,
          stateCode,
          address: inv.partyAddress,
          pin: inv.partyPin,
          pan,
          gstLocations: [
            {
              gstin: normGstin,
              stateCode,
              state: inv.partyState || '',
              address: inv.partyAddress || '',
              pincode: inv.partyPin || '',
              isPrimary: true
            }
          ],
          primaryGstinIndex: 0,
          partyType: 'SUPPLIER',
          openingBalance: 0,
          balanceType: 'CR',
          createdBy: username
        });

        // Provision in Chart of Accounts
        await resolveLedgerPostingAccount({
          firmId: firmIdObj,
          accountHead: newParty.name,
          fallbackType: 'SUNDRY_CREDITORS',
          partyId: newParty._id
        });

        partyDoc = newParty.toObject ? newParty.toObject() : newParty;
      }

      const isCreditNote = inv.docType === 'CREDIT_NOTE' || inv.invoiceType === 'C';
      const targetBtype = isCreditNote ? 'DEBIT_NOTE' : 'PURCHASE';

      // Step B: Duplicate check on supplierBillNo (Scoped to target Firm GSTIN and Bill Type)
      const dupQuery: any = {
        firmId: firmIdObj,
        partyId: partyDoc._id,
        btype: targetBtype,
        status: { $ne: 'CANCELLED' },
        supplierBillNo: { $regex: `^${normInvNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
      };
      if (normFirmGstin) {
        dupQuery.$or = [
          { firmGstin: normFirmGstin },
          { firmGstin: { $exists: false } },
          { firmGstin: null },
          { firmGstin: '' }
        ];
      }

      const existingBill = await Bill.findOne(dupQuery).select('_id bno btype').lean();

      if (existingBill) {
        throw new Error(`Already posted in this firm as ${existingBill.btype} voucher ${existingBill.bno}`);
      }

      // Step C: Determine Bill Sequence and Numbers
      const billNo = await getNextBillNumber(firmIdObj, 'ACCOUNTING_PURCHASE');
      const voucherId = await getNextVoucherNumber(firmIdObj);

      const partyInfo = await resolvePartyLocation(partyDoc, normGstin);

      // Step D: Format Line Items for Bill Storage
      const itemsList = (inv.items || []).length > 0 ? inv.items : [
        {
          rate: 18,
          taxableValue: inv.grossTotal,
          cgst: inv.cgst,
          sgst: inv.sgst,
          igst: inv.igst,
          cess: inv.cess || 0
        }
      ];

      const processedItems = itemsList.map((item: any) => ({
        item: `${purchaseAccount.accountHead} @ ${item.rate}%`,
        hsn: '',
        qty: 1,
        uom: 'NOS',
        rate: item.taxableValue || 0,
        grate: item.rate || 0,
        disc: 0,
        total: item.taxableValue || 0,
        cgst: item.cgst || 0,
        sgst: item.sgst || 0,
        igst: item.igst || 0,
        itemType: 'SERVICE' as const,
        ledgerAccountId: purchaseLedgerAccountId,
        ledgerAccountHead: purchaseAccount.accountHead,
        narration: `Rate ${item.rate}% - ${isCreditNote ? 'CR Note' : 'Inv'} ${normInvNo}`
      }));

      // Step E: Format Service Items for Double-Entry Ledger Posting
      const serviceItems = itemsList.map((item: any) => ({
        ledgerAccountHead: purchaseAccount.accountHead,
        ledgerAccountId: purchaseLedgerAccountId,
        description: `GSTR-2A Inward ${isCreditNote ? 'Credit Note reversal' : 'supply'} @ ${item.rate}% (${normInvNo})`,
        amount: item.taxableValue || 0,
        sacCode: ''
      }));

      // Step F: Create Bill Document
      const billData = {
        firmId: firmIdObj,
        voucherId: String(voucherId),
        bno: billNo,
        bdate: inv.invoiceDate || new Date().toISOString().split('T')[0],
        partyId: partyDoc._id,
        partyName: partyDoc.name,
        partyGstin: partyInfo.gstin,
        partyAddress: partyInfo.address,
        partyState: partyInfo.state,
        partyStateCode: partyInfo.stateCode,
        partyPin: partyInfo.pin,
        firmGstin: firmLoc?.gst_number,
        firmState: firmLoc?.state,
        firmStateCode: firmStateCode,
        grossTotal: Number(inv.grossTotal || 0),
        netTotal: Number(inv.netTotal || 0),
        roundOff: Number(inv.roundOff || 0),
        cgst: Number(inv.cgst || 0),
        sgst: Number(inv.sgst || 0),
        igst: Number(inv.igst || 0),
        cess: Number(inv.cess || 0),
        btype: targetBtype as any,
        billSubtype: isCreditNote ? 'PURCHASE_RETURN' : 'SERVICE',
        docType: inv.docType || (isCreditNote ? 'CREDIT_NOTE' : 'INVOICE'),
        invoiceMode: 'ACCOUNTING' as const,
        items: processedItems,
        otherCharges: [],
        supplierBillNo: normInvNo,
        narration: `Imported via GSTR-2A CSV (Place of Supply: ${inv.placeOfSupply || 'N/A'}${inv.irn ? `, IRN: ${inv.irn}` : ''})`,
        reverseCharge: !!inv.reverseCharge,
        irn: inv.irn,
        irnDate: inv.irnDate,
        source: inv.source,
        gstr1FilingStatus: inv.gstr1FilingStatus,
        gstr3bFilingStatus: inv.gstr3bFilingStatus,
        createdBy: username,
        status: 'ACTIVE' as const
      };

      const newBill = await Bill.create(billData);

      // Step G: Post to Double-Entry Ledger
      const ledgerParams = {
        firmId: firmIdObj,
        billId: newBill._id,
        voucherId: String(voucherId),
        billNo,
        billDate: newBill.bdate,
        party: { _id: partyDoc._id, name: partyDoc.name },
        netTotal: billData.netTotal,
        cgst: billData.cgst,
        sgst: billData.sgst,
        igst: billData.igst,
        cess: billData.cess,
        roundOff: billData.roundOff,
        otherCharges: [],
        serviceItems,
        reverseCharge: billData.reverseCharge,
        createdBy: username
      };

      if (isCreditNote) {
        await LedgerService.postAccountingDebitNoteLedger(ledgerParams);
      } else {
        await LedgerService.postAccountingPurchaseLedger(ledgerParams);
      }

      successCount++;
      results.push({
        invoiceNo: normInvNo,
        gstin: normGstin,
        success: true,
        billNo,
        billId: newBill._id.toString(),
        partyName: partyDoc.name
      });
    } catch (err: any) {
      failureCount++;
      results.push({
        invoiceNo: inv.invoiceNo || 'UNKNOWN',
        gstin: inv.gstin || 'UNKNOWN',
        success: false,
        error: err.message || 'Failed to post purchase bill'
      });
    }
  }

  return {
    success: true,
    message: `Batch posting completed: ${successCount} successful, ${failureCount} failed.`,
    data: {
      summary: {
        total: invoices.length,
        successCount,
        failureCount
      },
      results
    }
  };
});
