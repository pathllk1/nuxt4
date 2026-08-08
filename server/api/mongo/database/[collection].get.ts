import { defineEventHandler, createError, getQuery } from 'h3';
import { requireSuperAdmin } from '../../../utils/admin-guard';
import mongoose from 'mongoose';
import { connectDB } from '../../../utils/db';

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event);
  await connectDB();

  const collectionName = event.context.params?.collection;
  if (!collectionName) {
    throw createError({ statusCode: 400, statusMessage: 'Collection name is required' });
  }

  const queryParams = getQuery(event);
  const limit = parseInt(String(queryParams.limit || 50));
  const skip = parseInt(String(queryParams.skip || 0));

  try {
    if (!mongoose.connection.db) {
      throw createError({ statusCode: 503, statusMessage: 'MongoDB connection not ready' });
    }

    const collection = mongoose.connection.db.collection(collectionName);
    const data = await collection.find({}).skip(skip).limit(limit).toArray();
    const total = await collection.countDocuments();

    return {
      success: true,
      data,
      total
    };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || `Failed to fetch collection ${collectionName}`
    });
  }
});
