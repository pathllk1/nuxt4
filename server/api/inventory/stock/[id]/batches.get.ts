import mongoose from 'mongoose';
import Stock from '../../../../models/Stock';
import { requireAuthSession } from '../../../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const stockId = event.context.params?.id;

  if (!stockId || !mongoose.Types.ObjectId.isValid(stockId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid stock ID' });
  }

  const stock = await (Stock as any).findOne({
    _id: new mongoose.Types.ObjectId(stockId),
    firm_id: new mongoose.Types.ObjectId(String(user.firm_id))
  }).select('item qty uom batches').lean();

  if (!stock) {
    throw createError({ statusCode: 404, statusMessage: 'Stock item not found' });
  }

  return {
    success: true,
    data: {
      stockId: stock._id,
      item: stock.item,
      qty: stock.qty,
      uom: stock.uom,
      batches: stock.batches || []
    }
  };
});