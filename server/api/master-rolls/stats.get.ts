import { defineEventHandler, createError, getHeader } from 'h3';
import MasterRoll from '../../models/MasterRoll';
import mongoose from 'mongoose';

export default defineEventHandler(async (event) => {
  try {
    const firmId = getHeader(event, 'x-firm-id');
    if (!firmId) {
      throw createError({ statusCode: 400, statusMessage: 'Firm context required' });
    }

    const total = await MasterRoll.countDocuments({ firm_id: new mongoose.Types.ObjectId(firmId) });
    const total_active = await MasterRoll.countDocuments({ firm_id: new mongoose.Types.ObjectId(firmId), status: 'Active' });
    const left_employees = await MasterRoll.countDocuments({ firm_id: new mongoose.Types.ObjectId(firmId), status: 'Left' });
    
    const projectResult = await MasterRoll.distinct('project', { 
      firm_id: new mongoose.Types.ObjectId(firmId), 
      project: { $nin: [null, ''] } 
    });
    const siteResult = await MasterRoll.distinct('site', { 
      firm_id: new mongoose.Types.ObjectId(firmId), 
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
