import mongoose from 'mongoose';
import Party from '../../models/Party';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const query = getQuery(event);
  const { type, search } = query;

  const filter: any = { firmId: new mongoose.Types.ObjectId(String(user.firm_id)) };

  if (type) {
    filter.partyType = { $in: [(type as string).toUpperCase(), 'BOTH'] };
  }
  if (search) {
    const s = String(search).trim();
    filter.$or = [
      { name: { $regex: s, $options: 'i' } },
      { gstin: { $regex: s, $options: 'i' } },
      { contact: { $regex: s, $options: 'i' } }
    ];
  }

  const parties = await Party.find(filter).sort({ name: 1 }).lean();

  return {
    success: true,
    count: parties.length,
    data: parties
  };
});
