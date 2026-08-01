import mongoose from 'mongoose';
import Bill from '../../../models/Bill';
import { requireAuthSession } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const id = getRouterParam(event, 'id');

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid bill ID' });
  }

  const bill = await Bill.findOne({
    _id: id,
    firmId: new mongoose.Types.ObjectId(user.firm_id as string)
  } as any).populate('partyId').lean();

  if (!bill) {
    throw createError({ statusCode: 404, statusMessage: 'Bill not found' });
  }

  return {
    success: true,
    data: bill
  };
});
