import mongoose from 'mongoose';
import Bill from '../../../../models/Bill';
import Ledger from '../../../../models/Ledger';
import { requireAuthSession } from '../../../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const id = getRouterParam(event, 'id');
  const body = await readBody(event) || {};

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid bill ID' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const bill = await Bill.findOne({
      _id: id,
      firmId: new mongoose.Types.ObjectId(user.firm_id as string)
    }).session(session);

    if (!bill) {
      throw createError({ statusCode: 404, statusMessage: 'Bill not found' });
    }

    if (bill.status === 'CANCELLED') {
      throw createError({ statusCode: 400, statusMessage: 'Bill is already cancelled' });
    }

    bill.status = 'CANCELLED';
    bill.cancellationReason = body.reason || 'Cancelled by user';
    bill.cancelledAt = new Date();
    bill.cancelledBy = new mongoose.Types.ObjectId(user._id as string);

    await bill.save({ session });

    // 1. Post reversal ledger entries (immutable audit trail — never delete financial records)
    const firmIdObj = new mongoose.Types.ObjectId(user.firm_id as string);
    const originalEntries = await Ledger.find({
      $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }],
      refType: 'BILL',
      refId: bill._id
    }).session(session).lean();

    if (originalEntries.length > 0) {
      const reversalVoucherGroupId = `CANCEL-${bill.voucherId || bill._id}`;
      const reversalLegs = originalEntries.map((orig: any) => ({
        accountHead: orig.accountHead,
        accountType: orig.accountType,
        debitAmount: orig.creditAmount || 0, // Swap: original CR -> reversal DR
        creditAmount: orig.debitAmount || 0, // Swap: original DR -> reversal CR
        narration: `CANCELLATION REVERSAL: ${orig.narration || ''} [Original Bill: ${bill.bno}]`,
        partyId: orig.partyId || null,
        stockId: orig.stockId || null,
        stockRegId: orig.stockRegId || null,
        bankAccountId: orig.bankAccountId || null,
      }));

      const { UnifiedPostingService } = await import('../../../../utils/accounting/unified-posting.service');
      const { mapLegacyVoucherType } = await import('../../../../utils/accounting/posting-adapter');

      await UnifiedPostingService.postVoucher({
        firmId: firmIdObj,
        voucherType: mapLegacyVoucherType(bill.btype || 'JOURNAL'),
        transactionDate: (new Date().toISOString().split('T')[0] as string),
        narration: `CANCELLATION REVERSAL: [Original Bill: ${bill.bno}] - ${body.reason || 'User cancellation'}`,
        legs: reversalLegs,
        createdBy: user.username || user.email || 'system',
        refType: 'BILL_CANCELLATION',
        refId: bill._id,
        externalVoucherGroupId: reversalVoucherGroupId,
        externalVoucherNo: `CANCEL/${bill.bno}`,
      }, session);

      // Mark original ledger entries as reversed
      await Ledger.updateMany(
        { $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }], refType: 'BILL', refId: bill._id },
        { $set: { isReversed: true, reversedBy: reversalVoucherGroupId } },
        { session }
      );
    }

    // 2. Reverse inventory movements for SALES and PURCHASE bills
    if (['SALES', 'PURCHASE'].includes(bill.btype) && Array.isArray(bill.items) && bill.items.length > 0) {
      const { StockService } = await import('../../../../utils/inventory/stock.service');
      for (const item of bill.items) {
        if (!item.item || !item.qty || item.qty <= 0) continue;
        try {
          if (bill.btype === 'SALES') {
            // Cancel Sales -> return goods back to inventory (inward)
            await StockService.updateStockInward({
              firmId: firmIdObj,
              itemData: {
                stockId: item.stockId,
                item: item.item,
                hsn: item.hsn || '',
                qty: item.qty,
                rate: item.rate || 0,
                grate: item.grate || 0,
                uom: item.uom || 'PCS',
                narration: `Cancellation inward for bill ${bill.bno}`
              },
              billData: {
                bno: `CANCEL/${bill.bno}`,
                bdate: new Date().toISOString().split('T')[0] as string,
                supply: 'CANCELLATION',
                billId: bill._id,
                btype: 'SALES_CANCEL'
              },
              user: String(user.username || user.email || 'system'),
              session
            });
          } else if (bill.btype === 'PURCHASE') {
            // Cancel Purchase -> remove goods back out of inventory (outward)
            await StockService.updateStockOutward({
              firmId: firmIdObj,
              itemData: {
                stockId: item.stockId,
                item: item.item,
                hsn: item.hsn || '',
                qty: item.qty,
                rate: item.rate || 0,
                grate: item.grate || 0,
                uom: item.uom || 'PCS',
                narration: `Cancellation outward for bill ${bill.bno}`
              },
              billData: {
                bno: `CANCEL/${bill.bno}`,
                bdate: new Date().toISOString().split('T')[0] as string,
                supply: 'CANCELLATION',
                billId: bill._id,
                btype: 'PURCHASE_CANCEL'
              },
              user: String(user.username || user.email || 'system'),
              session
            });
          }
        } catch (stockErr: any) {
          console.warn(`[Bill Cancel] Stock reversal warning for item ${item.item}:`, stockErr.message);
        }
      }
    }

    await session.commitTransaction();
    session.endSession();

    return {
      success: true,
      message: `Bill ${bill.bno} cancelled successfully`,
      data: bill
    };
  } catch (err: any) {
    await session.abortTransaction();
    session.endSession();
    throw createError({ statusCode: err.statusCode || 500, statusMessage: err.message });
  }
});
