import { defineEventHandler, createError } from 'h3';
import MasterRoll from '../../models/MasterRoll';
import Wage from '../../models/Wage';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    // Fix #7: Use requireAuthSession instead of raw x-firm-id header
    const user = await requireAuthSession(event);

    const [mrProjects, wageProjects, mrSites, wageSites, categories, banks] = await Promise.all([
      MasterRoll.distinct('project', { firm_id: user.firm_id, project: { $nin: [null, ''] } }),
      Wage.distinct('project', { firm_id: user.firm_id, project: { $nin: [null, ''] } }),
      MasterRoll.distinct('site', { firm_id: user.firm_id, site: { $nin: [null, ''] } }),
      Wage.distinct('site', { firm_id: user.firm_id, site: { $nin: [null, ''] } }),
      MasterRoll.distinct('category', { firm_id: user.firm_id, category: { $nin: [null, ''] } }),
      MasterRoll.distinct('bank', { firm_id: user.firm_id, bank: { $nin: [null, ''] } })
    ]);

    const sanitizeList = (items: any[]) => {
      const cleanSet = new Set<string>();
      for (const item of items) {
        if (typeof item === 'string') {
          const trimmed = item.trim();
          if (trimmed.length > 0) cleanSet.add(trimmed);
        }
      }
      return Array.from(cleanSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    };

    return {
      success: true,
      data: {
        projects: sanitizeList([...mrProjects, ...wageProjects]),
        sites: sanitizeList([...mrSites, ...wageSites]),
        categories: sanitizeList(categories),
        banks: sanitizeList(banks)
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
