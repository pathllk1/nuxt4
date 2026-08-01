import mongoose from 'mongoose';
import Advance from '../../../models/Advance';
import { requireAuthSession } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const masterRollId = getRouterParam(event, 'masterRollId');

  try {
    const history = await Advance.find({
      firm_id: user.firm_id,
      master_roll_id: masterRollId
    }).sort({ date: -1, createdAt: -1 }).lean();

    return { success: true, data: history };
  } catch (err: any) {
    throw createError({
      statusCode: 500,
      message: err.message
    });
  }
});
