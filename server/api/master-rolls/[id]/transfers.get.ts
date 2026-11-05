import mongoose from 'mongoose';
import EmployeeSiteTransfer from '../../../models/EmployeeSiteTransfer';
import MasterRoll from '../../../models/MasterRoll';
import { requireAuthSession } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const id = getRouterParam(event, 'id');

  if (!id || !mongoose.isValidObjectId(id)) {
    throw createError({ statusCode: 400, message: 'Valid employee ID required' });
  }

  const employee = await MasterRoll.findOne({
    _id: new mongoose.Types.ObjectId(id),
    firm_id: user.firm_id,
  }).select('employee_name project site status').lean();

  if (!employee) {
    throw createError({ statusCode: 404, message: 'Employee not found' });
  }

  const transfers = await EmployeeSiteTransfer.find({
    firm_id: user.firm_id,
    master_roll_id: new mongoose.Types.ObjectId(id),
  })
    .sort({ effective_date: -1, createdAt: -1 })
    .populate('created_by', 'name username')
    .lean();

  return {
    success: true,
    data: {
      employee,
      transfers,
      totalTransfers: transfers.length,
    },
  };
});

