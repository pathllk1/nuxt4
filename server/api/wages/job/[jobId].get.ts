import WageJob from '../../../models/WageJob';
import { requireAuthSession } from '../../../utils/auth';
import { requireWageRole } from '../../../utils/wage-authz';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  await requireWageRole(event, user, ['Owner', 'Admin', 'Manager']);

  const jobId = getRouterParam(event, 'jobId');

  const job = await WageJob.findOne({
    _id: jobId,
    firm_id: user.firm_id
  }).lean();

  if (!job) {
    throw createError({
      statusCode: 404,
      message: 'Wage job not found'
    });
  }

  return { success: true, data: job };
});