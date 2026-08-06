import Wage from '../../../models/Wage';
import { requireAuthSession } from '../../../utils/auth';
import { requireWageRole } from '../../../utils/wage-authz';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  await requireWageRole(event, user, ['Owner', 'Admin']);

  const id = getRouterParam(event, 'id');

  const wage = await Wage.findOne({ _id: id, firm_id: user.firm_id });
  if (!wage) {
    throw createError({ statusCode: 404, message: 'Wage record not found' });
  }

  if (wage.status !== 'POSTED') {
    throw createError({
      statusCode: 400,
      message: `Only POSTED wages can be locked (current status: ${wage.status})`
    });
  }

  wage.status = 'LOCKED';
  wage.updated_by = user._id as any;
  await wage.save();

  return { success: true, message: 'Wage locked', data: wage };
});