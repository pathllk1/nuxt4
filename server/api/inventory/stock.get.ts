import { defineEventHandler, createError } from 'h3';
import mongoose from 'mongoose';

export default defineEventHandler(async (event) => {
  try {
    let stocks: any[] = [];
    if (mongoose.connection.db) {
      try {
        stocks = await mongoose.connection.db.collection('stocks').find({}).toArray();
      } catch (err) {
        console.warn('Stocks collection find failed:', err);
      }
    }

    return {
      success: true,
      statusCode: 200,
      data: stocks
    };
  } catch (error: any) {
    console.error('Get inventory stock error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error fetching stock'
    });
  }
});
