import mongoose from 'mongoose';
import Bill from '../../models/Bill';
import Party from '../../models/Party';
import { LedgerService } from '../../utils/accounting/ledger.service';
import { getNextBillNumber, getNextVoucherNumber, calcBillTotals, getEffectiveItemQty, ensureUniqueSupplierBillNo } from '../../utils/accounting/bill-utils';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const body = await readBody(event) || {};
  const { meta, party, cart, otherCharges } = body;

  if (!cart?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Cart cannot be empty' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const firmIdObj = new mongoose.Types.ObjectId(user.firm_id as string);
    const partyId = party.id || party._id || party;

    const partyDoc = await Party.findOne({ _id: partyId, firmId: firmIdObj }).session(session).lean();
    if (!partyDoc) {
      throw createError({ statusCode: 404, statusMessage: 'Party not found' });
    }

    if (meta?.supplierBillNo) {
      await ensureUniqueSupplierBillNo({
        firmId: firmIdObj,
        partyId: partyDoc._id as mongoose.Types.ObjectId,
        supplierBillNo: meta.supplierBillNo
      });
    }

    const billType = (meta?.billType || 'intra-state').toLowerCase();
    const billNo = await getNextBillNumber(firmIdObj, 'PURCHASE');
    const voucherId = await getNextVoucherNumber(firmIdObj);

    const gstEnabled = true;
    const totals = calcBillTotals(cart, otherCharges, gstEnabled, billType, !!meta?.reverseCharge, getEffectiveItemQty);

    const processedItems = cart.map((item: any) => {
      const qty = getEffectiveItemQty(item);
      const lineValue = qty * (item.rate || 0) * (1 - ((item.disc || 0) / 100));
      let itemCgst = 0, itemSgst = 0, itemIgst = 0;
      if (gstEnabled) {
        const taxRate = parseFloat(item.grate) || 0;
        if (billType === 'intra-state') {
          itemCgst = lineValue * (taxRate / 200);
          itemSgst = lineValue * (taxRate / 200);
        } else {
          itemIgst = lineValue * (taxRate / 100);
        }
      }
      return {
        ...item,
        qty,
        total: lineValue,
        cgst: itemCgst,
        sgst: itemSgst,
        igst: itemIgst
      };
    });

    const [newBill] = await Bill.create([{
      firmId: firmIdObj,
      voucherId: String(voucherId),
      bno: billNo,
      bdate: meta?.billDate || new Date().toISOString().split('T')[0],
      partyId: partyDoc._id,
      partyName: partyDoc.name,
      partyGstin: partyDoc.gstin,
      partyAddress: partyDoc.address,
      partyState: partyDoc.state,
      partyStateCode: partyDoc.stateCode,
      grossTotal: totals.grossTotal,
      netTotal: totals.netTotal,
      roundOff: totals.roundOff,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: totals.igst,
      btype: 'PURCHASE',
      billSubtype: billType.toUpperCase(),
      items: processedItems,
      otherCharges: otherCharges || [],
      supplierBillNo: meta?.supplierBillNo,
      orderNo: meta?.referenceNo,
      narration: meta?.narration,
      reverseCharge: !!meta?.reverseCharge,
      createdBy: user.username || user.email || 'system',
      status: 'ACTIVE'
    }], { session });

    // Post Purchase to Double-Entry Ledger
    const ledgerParams = {
      firmId: firmIdObj,
      billId: newBill._id,
      voucherId: String(voucherId),
      billNo,
      billDate: newBill.bdate,
      party: { _id: partyDoc._id, name: partyDoc.name },
      netTotal: totals.netTotal,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: totals.igst,
      roundOff: totals.roundOff,
      otherCharges: otherCharges || [],
      purchasedItems: processedItems.map((pi: any) => ({
        stockId: pi.stockId,
        item: pi.item,
        lineValue: pi.total
      })),
      createdBy: user.username || user.email || 'system',
      session
    };

    await LedgerService.postPurchaseLedger(ledgerParams);

    await session.commitTransaction();
    session.endSession();

    return {
      success: true,
      message: 'Purchase bill created successfully',
      data: newBill
    };
  } catch (err: any) {
    await session.abortTransaction();
    session.endSession();
    throw createError({ statusCode: err.statusCode || 500, statusMessage: err.message });
  }
});
