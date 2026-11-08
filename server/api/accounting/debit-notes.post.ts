import mongoose from 'mongoose';
import Bill from '../../models/Bill';
import StockReg from '../../models/StockReg';
import { LedgerService } from '../../utils/accounting/ledger.service';
import { StockService } from '../../utils/inventory/stock.service';
import { getNextBillNumber, getNextVoucherNumber, calcBillTotals, getEffectiveItemQty, isServiceItem } from '../../utils/accounting/bill-utils';
import { isGstEnabled } from '../../utils/accounting/bill-shared';
import { requireAuthSession } from '../../utils/auth';
import { connectDB } from '../../plugins/mongodb';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const body = (await readBody(event)) || {};
  const { originalBillId, returnCart, narration } = body;

  if (!originalBillId || !mongoose.Types.ObjectId.isValid(originalBillId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid original purchase bill ID' });
  }
  if (!returnCart?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Return cart cannot be empty' });
  }

  await connectDB();

  const firmIdObj = new mongoose.Types.ObjectId(String(user.firm_id));
  const username = user.username || user.email || 'system';

  const executeDebitNote = async (session?: mongoose.ClientSession) => {
    const origBillQuery = (Bill as any).findOne({ _id: new mongoose.Types.ObjectId(originalBillId), firmId: firmIdObj });
    if (session) origBillQuery.session(session);
    const originalBill = await origBillQuery.lean();

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

    const dnBillData = {
      ...original,
      firmId: firmIdObj,
      bno: billNo,
      voucherId: String(voucherId),
      btype: 'DEBIT_NOTE',
      bdate: new Date().toISOString().split('T')[0],
      items: processedItems,
      grossTotal: totals.grossTotal,
      netTotal: totals.netTotal,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: totals.igst,
      roundOff: totals.roundOff,
      narration: narration || `Debit Note against Purchase Bill ${originalBill.bno}`,
      originalBillId: originalBill._id,
      originalBillNo: originalBill.bno,
      createdBy: username,
      status: 'ACTIVE'
    };

    const dnBill = session
      ? (await (Bill as any).create([dnBillData], { session }))[0]
      : await (Bill as any).create(dnBillData);

    const purchasedItems: any[] = [];
    for (const item of processedItems) {
      const isService = isServiceItem(item);
      if (isService) {
        const sRegData = {
          firm_id: firmIdObj,
          type: 'DEBIT_NOTE',
          bno: billNo,
          bdate: dnBill.bdate,
          supply: originalBill.partyName,
          item: item.item,
          item_type: 'SERVICE',
          qty: item.qty,
          uom: item.uom,
          hsn: item.hsn,
          rate: item.rate,
          grate: item.grate,
          disc: item.disc || 0,
          total: item.total,
          bill_id: dnBill._id,
          user: username,
          qtyh: 0,
          item_narration: item.narration
        };
        if (session) {
          await StockReg.create([sRegData], { session });
        } else {
          await StockReg.create(sRegData);
        }
      } else {
        const stockMove = await StockService.updateStockOutward({
          firmId: firmIdObj,
          itemData: {
            stockId: item.stockId,
            item: item.item,
            hsn: item.hsn,
            qty: item.qty,
            rate: item.rate,
            grate: item.grate,
            uom: item.uom,
            narration: item.narration
          },
          billData: {
            bno: billNo,
            bdate: dnBill.bdate,
            supply: originalBill.partyName,
            billId: dnBill._id,
            btype: 'DEBIT_NOTE'
          },
          user: username,
          session
        });
        purchasedItems.push({
          item: item.item,
          total: item.total,
          grate: item.grate,
          stockId: stockMove.stock?._id || item.stockId
        });
      }
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

    return dnBill;
  };

  let session: mongoose.ClientSession | null = null;
  let dnBill: any;

  try {
    session = await mongoose.connection.startSession();
    session.startTransaction();
    dnBill = await executeDebitNote(session);
    await session.commitTransaction();
  } catch (err: any) {
    if (session) {
      try { await session.abortTransaction(); } catch (_) {}
    }

    if (
      err.message?.includes('ClientSession must be from the same MongoClient') ||
      err.message?.includes('replica set') ||
      err.message?.includes('Transaction numbers')
    ) {
      console.warn('[Debit Note Post] Retrying without transaction session:', err.message);
      try {
        dnBill = await executeDebitNote(undefined);
      } catch (retryErr: any) {
        throw createError({ statusCode: retryErr.statusCode || 500, statusMessage: retryErr.message || 'Failed to create debit note' });
      }
    } else {
      throw createError({ statusCode: err.statusCode || 500, statusMessage: err.message || 'Failed to create debit note' });
    }
  } finally {
    if (session) {
      try { session.endSession(); } catch (_) {}
    }
  }

  return { success: true, message: 'Debit note created successfully', data: dnBill };
});
