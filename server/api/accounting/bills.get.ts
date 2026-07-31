import { defineEventHandler, createError, getQuery } from 'h3';
import mongoose from 'mongoose';

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const limit = query.limit ? parseInt(query.limit as string, 10) : 50;

    let bills: any[] = [];
    if (mongoose.connection.db) {
      try {
        bills = await mongoose.connection.db.collection('bills').find({}).limit(limit).toArray();
      } catch (err) {
        console.warn('Bills collection find failed:', err);
      }
    }

    return {
      success: true,
      statusCode: 200,
      data: bills
    };
  } catch (error: any) {
    console.error('Get accounting bills error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error fetching bills'
    });
  }
});
