import { defineEventHandler, getQuery } from 'h3';
import mongoose from 'mongoose';
import { requireAuthSession } from '../../../utils/auth';
import StockReg from '../../../models/StockReg';

export default defineEventHandler(async (event) => {
  let firmIdStr = '';
  try {
    const user = await requireAuthSession(event);
    firmIdStr = String(user.firm_id);
  } catch {}

  const queryParams = getQuery(event);
  const startDate = queryParams.startDate ? String(queryParams.startDate) : '';
  const endDate = queryParams.endDate ? String(queryParams.endDate) : '';

  const matchFilter: any = {
    type: { $in: ['SALE', 'SALES', 'OUTWARD'] }
  };

  if (firmIdStr && mongoose.Types.ObjectId.isValid(firmIdStr)) {
    const fid = new mongoose.Types.ObjectId(firmIdStr);
    matchFilter.$or = [
      { firm_id: fid },
      { firmId: fid },
      { firm_id: firmIdStr },
      { firmId: firmIdStr }
    ];
  }

  if (startDate || endDate) {
    matchFilter.createdAt = {};
    if (startDate) matchFilter.createdAt.$gte = new Date(startDate);
    if (endDate) matchFilter.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
  }

  try {
    const sales = await StockReg.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$stockId',
          item: { $first: '$item' },
          hsn: { $first: '$hsn' },
          uom: { $first: '$uom' },
          totalQty: { $sum: { $abs: '$qty' } },
          totalRevenue: { $sum: { $ifNull: ['$total', { $multiply: ['$qty', '$rate'] }] } },
          avgRate: { $avg: '$rate' },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    return {
      success: true,
      data: sales
    };
  } catch (error: any) {
    console.error('Sales analysis error:', error);
    return {
      success: true,
      data: []
    };
  }
});
