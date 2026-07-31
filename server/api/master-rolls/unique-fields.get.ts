import { defineEventHandler, createError, getHeader } from 'h3';
import MasterRoll from '../../models/MasterRoll';
import mongoose from 'mongoose';

export default defineEventHandler(async (event) => {
  try {
    const firmId = getHeader(event, 'x-firm-id');
    if (!firmId) {
      throw createError({ statusCode: 400, statusMessage: 'Firm context required' });
    }

    const fid = new mongoose.Types.ObjectId(firmId);

    const [projects, sites, categories, banks] = await Promise.all([
      MasterRoll.distinct('project', { firm_id: fid, project: { $nin: [null, ''] } }),
      MasterRoll.distinct('site', { firm_id: fid, site: { $nin: [null, ''] } }),
      MasterRoll.distinct('category', { firm_id: fid, category: { $nin: [null, ''] } }),
      MasterRoll.distinct('bank', { firm_id: fid, bank: { $nin: [null, ''] } })
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
