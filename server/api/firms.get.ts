import { defineEventHandler, createError } from 'h3';
import Firm from '../models/Firm';
import { connectDB } from '../plugins/mongodb';

export default defineEventHandler(async (event) => {
  try {
    await connectDB();
    const firms = await Firm.find({ status: { $ne: 'rejected' } })
      .select('name code _id status')
      .lean();

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
