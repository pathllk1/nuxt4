import { defineEventHandler, createError, getHeader, getRouterParam } from 'h3';
import MasterRoll from '../../../models/MasterRoll';
import mongoose from 'mongoose';

export default defineEventHandler(async (event) => {
  try {
    const firmId = getHeader(event, 'x-firm-id');
    if (!firmId) {
      throw createError({ statusCode: 400, statusMessage: 'Firm context required' });
    }

    const id = getRouterParam(event, 'id');

    const employee = await MasterRoll.findOne({
      _id: new mongoose.Types.ObjectId(id!),
      firm_id: new mongoose.Types.ObjectId(firmId)
    }).lean();

    if (!employee) {
      throw createError({ statusCode: 404, statusMessage: 'Employee not found' });
    }

    // Activity log is stored as a virtual computed from audit trail
    // For now return a simplified activity based on created/updated timestamps
    const activities = [];
    
    if ((employee as any).createdAt) {
      activities.push({
        action: 'created',
        timestamp: (employee as any).createdAt,
        user_name: 'System',
        user_email: '',
        user_role: ''
      });
    }
    
    if ((employee as any).updatedAt && (employee as any).updatedAt !== (employee as any).createdAt) {
      activities.push({
        action: 'updated',
        timestamp: (employee as any).updatedAt,
        user_name: 'System',
        user_email: '',
        user_role: ''
      });
    }

    return {
      success: true,
      data: activities
    };
  } catch (error: any) {
    console.error('Get activity log error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error fetching activity log'
    });
  }
});
