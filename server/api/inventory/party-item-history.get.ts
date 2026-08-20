import { defineEventHandler, getQuery, createError } from 'h3';
import mongoose from 'mongoose';
import Bill from '../../models/Bill';
import Stock from '../../models/Stock';
import Party from '../../models/Party';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event);
  const query = getQuery(event);

  const firmIdObj = new mongoose.Types.ObjectId(String(session.firm_id));
  const partyId = query.partyId ? String(query.partyId) : undefined;
  const stockId = query.stockId ? String(query.stockId) : undefined;
  const itemName = query.itemName ? String(query.itemName).trim() : undefined;
  const mode = String(query.mode || 'sales').toLowerCase(); // 'sales' or 'purchase'

  if (!stockId && !itemName) {
    throw createError({ statusCode: 400, statusMessage: 'Either stockId or itemName is required' });
  }

  // 1. Fetch Party Details if partyId provided
  let partyDetails: any = null;
  if (partyId && mongoose.Types.ObjectId.isValid(partyId)) {
    partyDetails = await Party.findOne({ _id: new mongoose.Types.ObjectId(partyId), firmId: firmIdObj })
      .select('name gstin contact state address openingBalance balanceType')
      .lean();
  }

  // 2. Fetch Stock Details if stockId provided or by name
  let stockDetails: any = null;
  if (stockId && mongoose.Types.ObjectId.isValid(stockId)) {
    stockDetails = await Stock.findOne({ _id: new mongoose.Types.ObjectId(stockId), firm_id: firmIdObj })
      .select('name hsn uom qty s_rate rate mrp min_qty')
      .lean();
  } else if (itemName) {
    stockDetails = await Stock.findOne({
      firm_id: firmIdObj,
      name: { $regex: `^${itemName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
    })
      .select('name hsn uom qty s_rate rate mrp min_qty')
      .lean();
  }

  // 3. Build Query Filters for Bills containing this item
  const itemMatchCondition: any = {};
  if (stockId && mongoose.Types.ObjectId.isValid(stockId)) {
    itemMatchCondition['items.stockId'] = new mongoose.Types.ObjectId(stockId);
  } else if (itemName) {
    itemMatchCondition['items.item'] = { $regex: itemName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  }

  const billTypes = mode === 'purchase'
    ? ['PURCHASE', 'DEBIT_NOTE']
    : ['SALES', 'PROFORMA', 'DELIVERY_NOTE', 'CREDIT_NOTE'];

  // 4. Query Party-Specific History
  let partyHistory: any[] = [];
  if (partyId && mongoose.Types.ObjectId.isValid(partyId)) {
    const partyBills = await Bill.find({
      firmId: firmIdObj,
      partyId: new mongoose.Types.ObjectId(partyId),
      btype: { $in: billTypes },
      ...itemMatchCondition
    })
      .sort({ bdate: -1, createdAt: -1 })
      .limit(30)
      .lean();

    partyBills.forEach((b: any) => {
      (b.items || []).forEach((itm: any) => {
        const isMatch = (stockId && itm.stockId && String(itm.stockId) === stockId) ||
          (itemName && itm.item && itm.item.toLowerCase().includes(itemName.toLowerCase()));

        if (isMatch) {
          const rate = Number(itm.rate || 0);
          const disc = Number(itm.disc || 0);
          const netRate = disc > 0 ? Number((rate * (1 - disc / 100)).toFixed(2)) : rate;
          const gstRate = (Number(itm.cgst || 0) + Number(itm.sgst || 0) + Number(itm.igst || 0));

          partyHistory.push({
            billId: String(b._id),
            bno: b.bno,
            bdate: b.bdate,
            btype: b.btype,
            partyName: b.partyName || partyDetails?.name || 'Party',
            item: itm.item,
            hsn: itm.hsn || '',
            qty: Number(itm.qty || 0),
            uom: itm.uom || itm.unit || 'PCS',
            rate,
            disc,
            netRate,
            gstRate,
            total: Number(itm.total || (Number(itm.qty || 0) * netRate)),
            batch: itm.batch || ''
          });
        }
      });
    });
  }

  // 5. Query General History (Across All Parties for Market Reference)
  const generalBills = await Bill.find({
    firmId: firmIdObj,
    btype: { $in: billTypes },
    ...itemMatchCondition
  })
    .sort({ bdate: -1, createdAt: -1 })
    .limit(20)
    .lean();

  const generalHistory: any[] = [];
  generalBills.forEach((b: any) => {
    (b.items || []).forEach((itm: any) => {
      const isMatch = (stockId && itm.stockId && String(itm.stockId) === stockId) ||
        (itemName && itm.item && itm.item.toLowerCase().includes(itemName.toLowerCase()));

      if (isMatch) {
        const rate = Number(itm.rate || 0);
        const disc = Number(itm.disc || 0);
        const netRate = disc > 0 ? Number((rate * (1 - disc / 100)).toFixed(2)) : rate;

        generalHistory.push({
          billId: String(b._id),
          bno: b.bno,
          bdate: b.bdate,
          btype: b.btype,
          partyName: b.partyName || 'Customer',
          qty: Number(itm.qty || 0),
          uom: itm.uom || itm.unit || 'PCS',
          rate,
          disc,
          netRate,
          total: Number(itm.total || (Number(itm.qty || 0) * netRate))
        });
      }
    });
  });

  // 6. Query Opposite Stream (Purchase Cost if in Sales mode, or Last Selling Rate if in Purchase mode)
  const oppositeBillTypes = mode === 'purchase' ? ['SALES'] : ['PURCHASE'];
  const oppositeBills = await Bill.find({
    firmId: firmIdObj,
    btype: { $in: oppositeBillTypes },
    ...itemMatchCondition
  })
    .sort({ bdate: -1, createdAt: -1 })
    .limit(10)
    .lean();

  const referenceHistory: any[] = [];
  oppositeBills.forEach((b: any) => {
    (b.items || []).forEach((itm: any) => {
      const isMatch = (stockId && itm.stockId && String(itm.stockId) === stockId) ||
        (itemName && itm.item && itm.item.toLowerCase().includes(itemName.toLowerCase()));

      if (isMatch) {
        referenceHistory.push({
          billId: String(b._id),
          bno: b.bno,
          bdate: b.bdate,
          btype: b.btype,
          partyName: b.partyName || 'Supplier',
          qty: Number(itm.qty || 0),
          uom: itm.uom || itm.unit || 'PCS',
          rate: Number(itm.rate || 0),
          disc: Number(itm.disc || 0),
          total: Number(itm.total || 0)
        });
      }
    });
  });

  // 7. Calculate Statistical Aggregates for Party
  const ratesList = partyHistory.map(p => p.netRate).filter(r => r > 0);
  const totalQty = partyHistory.reduce((s, p) => s + p.qty, 0);
  const lastTransaction = partyHistory.length > 0 ? partyHistory[0] : null;
  const minRate = ratesList.length > 0 ? Math.min(...ratesList) : (stockDetails?.s_rate || stockDetails?.rate || 0);
  const maxRate = ratesList.length > 0 ? Math.max(...ratesList) : (stockDetails?.s_rate || stockDetails?.rate || 0);
  const avgRate = ratesList.length > 0 ? Number((ratesList.reduce((s, r) => s + r, 0) / ratesList.length).toFixed(2)) : 0;
  const lastPurchaseCost = referenceHistory.length > 0 ? referenceHistory[0]?.rate : (stockDetails?.rate || 0);

  return {
    success: true,
    data: {
      party: partyDetails ? {
        id: String(partyDetails._id),
        name: partyDetails.name || partyDetails.account_head,
        gstin: partyDetails.gstin,
        phone: partyDetails.phone,
        state: partyDetails.state,
        balance: partyDetails.balance,
        balanceType: partyDetails.balance_type
      } : null,
      item: {
        id: stockDetails ? String(stockDetails._id) : stockId,
        name: stockDetails?.name || itemName,
        hsn: stockDetails?.hsn || '',
        uom: stockDetails?.uom || 'PCS',
        currentStock: Number(stockDetails?.qty || 0),
        defaultSellingRate: Number(stockDetails?.s_rate || 0),
        purchaseCost: Number(stockDetails?.rate || 0),
        mrp: Number(stockDetails?.mrp || 0)
      },
      stats: {
        lastSoldDate: lastTransaction?.bdate || null,
        lastBilledRate: lastTransaction?.rate || null,
        lastBilledDisc: lastTransaction?.disc || 0,
        lastBilledNetRate: lastTransaction?.netRate || null,
        minRate,
        maxRate,
        avgRate,
        totalLifetimeQty: totalQty,
        lastReferenceCost: lastPurchaseCost,
        totalInvoicesWithParty: partyHistory.length
      },
      partyHistory,
      generalHistory,
      referenceHistory
    }
  };
});
