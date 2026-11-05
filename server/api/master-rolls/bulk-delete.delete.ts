import mongoose from 'mongoose';
import MasterRoll from '../../models/MasterRoll';
import Wage from '../../models/Wage';
import Advance from '../../models/Advance';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const body = await readBody(event);
  const ids: string[] = body?.ids || [];

  if (!Array.isArray(ids) || ids.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Array of employee IDs is required' });
  }

  const validObjectIds = ids
    .filter(id => id && mongoose.isValidObjectId(id))
    .map(id => new mongoose.Types.ObjectId(id));

  if (validObjectIds.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No valid employee ObjectIds provided' });
  }

  // 1. Guard against cascading deletion of historical payroll
  const activeWagesCount = await Wage.countDocuments({
    firm_id: user.firm_id,
    master_roll_id: { $in: validObjectIds }
  });

  // 2. Guard against orphaned advances/loans
  const activeAdvancesCount = await Advance.countDocuments({
    firm_id: user.firm_id,
    master_roll_id: { $in: validObjectIds }
  });

  if (activeWagesCount > 0 || activeAdvancesCount > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `Cannot delete selected employees: ${activeWagesCount} wage records and ${activeAdvancesCount} advance records exist. Mark employees as 'Inactive' or 'Left' instead.`
    });
  }

  const result = await MasterRoll.deleteMany({
    _id: { $in: validObjectIds },
    firm_id: user.firm_id
  });

  return {
    success: true,
    message: `Successfully deleted ${result.deletedCount} employees`,
    deletedCount: result.deletedCount
  };
});

