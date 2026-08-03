import { defineEventHandler } from 'h3';
import mongoose from 'mongoose';
import Firm from '../../models/Firm';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    let firm = null;
    try {
      const session = await requireAuthSession(event);
      if (session && session.firm_id) {
        firm = await Firm.findById(session.firm_id);
      }
    } catch {
      // Fallback if unauthenticated request
    }
    
    if (!firm) {
      firm = await Firm.findOne({ status: 'approved' });
    }
    if (!firm) {
      firm = await Firm.findOne({});
    }

    if (!firm) {
      return {
        success: false,
        statusCode: 404,
        message: 'No firm found',
        data: null
      };
    }

    let locations = (firm.locations && firm.locations.length > 0) ? firm.locations : [];
    if (locations.length === 0 && firm.gst_number) {
      locations = [{
        gst_number: firm.gst_number,
        state_code: firm.gst_number.substring(0, 2),
        state: firm.state || '',
        registration_type: 'PPOB',
        address: firm.address || '',
        city: firm.city || '',
        pincode: firm.pincode || '',
        is_default: true
      }];
    }

    return {
      success: true,
      statusCode: 200,
      message: 'Firm details fetched successfully',
      data: {
        _id: firm._id,
        name: firm.name,
        legal_name: firm.legal_name,
        gst_number: firm.gst_number,
        address: firm.address,
        state: firm.state,
        pincode: firm.pincode,
        gst_enabled: true,
        locations: locations
      }
    };
  } catch (error: any) {
    console.error('Fetch current firm API error:', error);
    return {
      success: false,
      statusCode: 500,
      message: error.message || 'Error fetching firm details',
      data: null
    };
  }
});
