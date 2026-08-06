import MasterRoll from '../../models/MasterRoll';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    // Bug (report B3): use the verified session instead of the x-firm-id header
    const user = await requireAuthSession(event);

    const total = await MasterRoll.countDocuments({ firm_id: user.firm_id });
    const total_active = await MasterRoll.countDocuments({ firm_id: user.firm_id, status: 'Active' });
    const left_employees = await MasterRoll.countDocuments({ firm_id: user.firm_id, status: 'Left' });

    const projectResult = await MasterRoll.distinct('project', {
      firm_id: user.firm_id,
      project: { $nin: [null, ''] }
    });
    const siteResult = await MasterRoll.distinct('site', {
      firm_id: user.firm_id,
      site: { $nin: [null, ''] }
    });

    return {
      success: true,
      data: {
        total_employees: total,
        total_active,
        left_employees,
        total_projects: projectResult.length,
        total_sites: siteResult.length
      }
    };
  } catch (error: any) {
    console.error('Get master-roll stats error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error fetching stats'
    });
  }
});