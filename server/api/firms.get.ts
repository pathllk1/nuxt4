import { defineEventHandler, createError } from 'h3';
import Firm from '../models/Firm';

export default defineEventHandler(async (event) => {
  try {
    const firms = await Firm.find({ status: 'approved' }).select('name code _id');
    return {
      success: true,
      statusCode: 200,
      message: 'Firms retrieved successfully',
      data: firms
    };
  } catch (error) {
    console.error('Fetch firms API error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Error fetching firms'
    });
  }
});
