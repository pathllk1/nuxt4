import mongoose from 'mongoose';
import Bill from '../../models/Bill';
import StockReg from '../../models/StockReg';
import { LedgerService } from '../../utils/accounting/ledger.service';
import { StockService } from '../../utils/inventory/stock.service';
import { getNextBillNumber, getNextVoucherNumber, calcBillTotals, getEffectiveItemQty, isServiceItem } from '../../utils/accounting/bill-utils';
import { isGstEnabled } from '../../utils/accounting/bill-shared';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const body = await readBody(event) || {};
  const { originalBillId, returnCart, narration } = body;

  if (!originalBillId || !mongoose.Types.ObjectId.isValid(originalBillId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid original purchase bill ID' });
  }
  if (!returnCart?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Return cart cannot be empty' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const firmIdObj = new mongoose.Types.ObjectId(String(user.firm_id));
    const username = user.username || user.email || 'system';
    const originalBill = await (Bill as any).findOne({ _id: new mongoose.Types.ObjectId(originalBillId), firmId: firmIdObj }).session(session).lean();
    if (!originalBill || originalBill.btype !== 'PURCHASE') {
      throw createError({ statusCode: 400, statusMessage: 'Invalid original purchase bill' });
    }

    const billNo = await getNextBillNumber(firmIdObj, 'DEBIT_NOTE');
    const voucherId = await getNextVoucherNumber(firmIdObj);
    const billType = String(originalBill.billSubtype || 'INTRA-STATE').toLowerCase();
    const gstEnabled = await isGstEnabled(firmIdObj);
    const totals = calcBillTotals(returnCart, [], gstEnabled, billType, !!originalBill.reverseCharge, getEffectiveItemQty);

    const processedItems = returnCart.map((item: any) => {
      const qty = getEffectiveItemQty(item);
      const lineValue = qty * (item.rate || 0) * (1 - ((item.disc || 0) / 100));
      const taxRate = parseFloat(item.grate) || 0;
      return {
        ...item,
        qty,
        total: lineValue,
        cgst: gstEnabled && billType === 'intra-state' ? lineValue * (taxRate / 200) : 0,
        sgst: gstEnabled && billType === 'intra-state' ? lineValue * (taxRate / 200) : 0,
        igst: gstEnabled && billType !== 'intra-state' ? lineValue * (taxRate / 100) : 0
      };
    });

    const original = { ...originalBill };
    delete original._id;
    delete original.createdAt;
    delete original.updatedAt;

    const [dnBill] = await (Bill as any).create([{
      ...original,
      firmId: firmIdObj,
      refBillId: originalBill._id,
      bno: billNo,
      voucherId: String(voucherId),
      bdate: new Date().toISOString().split('T')[0],
      btype: 'DEBIT_NOTE',
      grossTotal: totals.grossTotal,
      netTotal: totals.netTotal,
      roundOff: totals.roundOff,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: totals.igst,
      items: processedItems,
      otherCharges: [],
      narration,
      createdBy: username,
      status: 'ACTIVE'
    }], { session });

    const purchasedItems: Array<{ stockId: any; stockRegId: any; item: string; lineValue: number }> = [];
    for (const item of processedItems) {
      const qty = item.qty;
      const lineValue = item.total;
      if (isServiceItem(item)) {
        await (StockReg as any).create([{
          firm_id: firmIdObj,
          type: 'DEBIT_NOTE',
          bno: billNo,
          bdate: dnBill.bdate,
          supply: originalBill.partyName,
          item: item.item,
          item_type: 'SERVICE',
          qty,
          uom: item.uom,
          hsn: item.hsn,
          rate: item.rate,
          grate: item.grate,
          disc: item.disc || 0,
          total: lineValue,
          bill_id: dnBill._id,
          user: username,
          qtyh: 0,
          item_narration: item.narration
        }], { session });
        continue;
      }

      if (!item.stockId) throw new Error(`Stock ID is required for ${item.item}`);
      await StockService.updateStockOutward({
        firmId: firmIdObj,
        itemData: { stockId: new mongoose.Types.ObjectId(item.stockId), qty, rate: item.rate, grate: item.grate, batch: item.batch, narration: item.narration },
        billData: { bno: billNo, bdate: dnBill.bdate, supply: originalBill.partyName, billId: dnBill._id, btype: 'DEBIT_NOTE' },
        user: username,
        session
      });
      const reg = await (StockReg as any).findOne({ bill_id: dnBill._id, stock_id: item.stockId }).sort({ createdAt: -1 }).session(session);
      purchasedItems.push({ stockId: item.stockId, stockRegId: reg?._id, item: item.item, lineValue });
    }

    await LedgerService.postDebitNoteLedger({
      firmId: firmIdObj,
      billId: dnBill._id,
      voucherId: String(voucherId),
      billNo,
      billDate: dnBill.bdate,
      party: { name: originalBill.partyName, _id: originalBill.partyId },
      netTotal: totals.netTotal,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: totals.igst,
      roundOff: totals.roundOff,
      otherCharges: [],
      purchasedItems,
      createdBy: username,
      session
    } as any);

    await session.commitTransaction();
    return { success: true, message: 'Debit note created successfully', data: dnBill };
  } catch (err: any) {
    await session.abortTransaction();
    throw createError({ statusCode: err.statusCode || 500, statusMessage: err.message || 'Failed to create debit note' });
  } finally {
    session.endSession();
  }
});