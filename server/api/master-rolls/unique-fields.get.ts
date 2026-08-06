import { defineEventHandler, createError } from 'h3';
import MasterRoll from '../../models/MasterRoll';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    // Fix #7: Use requireAuthSession instead of raw x-firm-id header
    const user = await requireAuthSession(event);

    const [projects, sites, categories, banks] = await Promise.all([
      MasterRoll.distinct('project', { firm_id: user.firm_id, project: { $nin: [null, ''] } }),
      MasterRoll.distinct('site', { firm_id: user.firm_id, site: { $nin: [null, ''] } }),
      MasterRoll.distinct('category', { firm_id: user.firm_id, category: { $nin: [null, ''] } }),
      MasterRoll.distinct('bank', { firm_id: user.firm_id, bank: { $nin: [null, ''] } })
    ]);

    return {
      success: true,
      data: {
        projects: projects.sort(),
        sites: sites.sort(),
        categories: categories.sort(),
        banks: banks.sort()
      }
    };
  } catch (error: any) {
    console.error('Get unique fields error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error fetching unique fields'
    });
  }
});
