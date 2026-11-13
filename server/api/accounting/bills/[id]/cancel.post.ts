import mongoose from 'mongoose';
import Bill from '../../../../models/Bill';
import Ledger from '../../../../models/Ledger';
import { requireAuthSession } from '../../../../utils/auth';
import { connectDB } from '../../../../plugins/mongodb';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const id = getRouterParam(event, 'id');
  const body = (await readBody(event)) || {};

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid bill ID' });
  }

  await connectDB();

  const firmIdObj = new mongoose.Types.ObjectId(user.firm_id as string);

  const executeCancel = async (session?: mongoose.ClientSession) => {
    const billQuery = Bill.findOne({
      _id: id,
      firmId: firmIdObj
    });
    if (session) billQuery.session(session);
    const bill = await billQuery;

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

    if (session) {
      await bill.save({ session });
    } else {
      await bill.save();
    }

    // 1. Post reversal ledger entries (immutable audit trail — never delete financial records)
    const ledgerFindQuery = Ledger.find({
      $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }],
      refType: 'BILL',
      refId: bill._id
    });
    if (session) ledgerFindQuery.session(session);
    const originalEntries = await ledgerFindQuery.lean();

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

      await UnifiedPostingService.postVoucher(
        {
          firmId: firmIdObj,
          voucherType: mapLegacyVoucherType(bill.btype || 'JOURNAL'),
          transactionDate: new Date().toISOString().split('T')[0] as string,
          narration: `CANCELLATION REVERSAL: [Original Bill: ${bill.bno}] - ${body.reason || 'User cancellation'}`,
          legs: reversalLegs,
          createdBy: user.username || user.email || 'system',
          refType: 'BILL_CANCELLATION',
          refId: bill._id,
          externalVoucherGroupId: reversalVoucherGroupId,
          externalVoucherNo: `CANCEL/${bill.bno}`,
        },
        session
      );

      // Mark original ledger entries as reversed with audit pointer (F-01)
      // Since reversalLegs (a counter-voucher) is posted, BOTH original and reversal voucher
      // remain in the general ledger and naturally net to 0. Marking isReversed: true would
      // exclude original while keeping reversalLegs, causing a double-reversal.
      await Ledger.updateMany(
        { $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }], refType: 'BILL', refId: bill._id },
        { $set: { reversalVoucherGroupId, reversedBy: reversalVoucherGroupId, reversedAt: new Date() } },
        session ? { session } : {}
      );
    }

    // 2. Reverse inventory movements for SALES and PURCHASE bills
    if (['SALES', 'PURCHASE'].includes(bill.btype) && Array.isArray(bill.items) && bill.items.length > 0) {
      const { StockService } = await import('../../../../utils/inventory/stock.service');
      for (const item of bill.items) {
        if (!item.item || !item.qty || item.qty <= 0) continue;
        try {
          if (bill.btype === 'SALES') {
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
          console.error(`[Bill Cancel] Stock reversal failed for item "${item.item}":`, stockErr.message);
          throw createError({
            statusCode: 500,
            statusMessage: `Failed to reverse inventory for item "${item.item}": ${stockErr.message}. Bill cancellation aborted to preserve warehouse inventory and financial ledger integrity.`
          });
        }
      }
    }

    return bill;
  };

  let session: mongoose.ClientSession | null = null;
  let cancelledBill: any;

  try {
    session = await mongoose.connection.startSession();
    session.startTransaction();
    cancelledBill = await executeCancel(session);
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
      console.error('[Bill Cancel] MongoDB transaction unsupported:', err.message);
      throw createError({
        statusCode: 500,
        statusMessage: 'MongoDB replica set transactions are required for bill cancellation to guarantee atomic reversal across commercial billing, financial General Ledger, and warehouse inventory. Non-transactional execution is prohibited.'
      });
    } else {
      throw createError({ statusCode: err.statusCode || 500, statusMessage: err.message });
    }
  } finally {
    if (session) {
      try { session.endSession(); } catch (_) {}
    }
  }

  return {
    success: true,
    message: `Bill ${cancelledBill.bno} cancelled successfully`,
    data: cancelledBill
  };
});
