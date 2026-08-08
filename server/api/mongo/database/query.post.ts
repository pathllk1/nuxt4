import { defineEventHandler, createError, readBody } from 'h3';
import { requireSuperAdmin } from '../../../utils/admin-guard';
import mongoose from 'mongoose';
import { connectDB } from '../../../utils/db';

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event);
  await connectDB();

  try {
    const { collection: collectionName, action = 'find', filter = {}, pipeline = [], limit = 50, skip = 0 } = await readBody(event);
    if (!collectionName) {
      throw createError({ statusCode: 400, statusMessage: 'Collection name is required' });
    }

    if (!mongoose.connection.db) {
      throw createError({ statusCode: 503, statusMessage: 'MongoDB connection not ready' });
    }

    const collection = mongoose.connection.db.collection(collectionName);
    const startTime = process.hrtime();
    let data: any;

    if (action === 'find') {
      data = await collection.find(filter).skip(skip).limit(limit).toArray();
    } else if (action === 'aggregate') {
      data = await collection.aggregate(pipeline).toArray();
    } else if (action === 'countDocuments') {
      data = { count: await collection.countDocuments(filter) };
    } else if (action === 'stats') {
      data = await mongoose.connection.db.command({ collStats: collectionName });
    } else {
      throw createError({ statusCode: 400, statusMessage: `Unsupported Mongo action: ${action}` });
    }

    const diff = process.hrtime(startTime);
    const executionTimeMs = (diff[0] * 1000 + diff[1] / 1000000).toFixed(2);

    return {
      success: true,
      data,
      executionTimeMs
    };
  } catch (error: any) {
    throw createError({
      statusCode: 400,
      statusMessage: error.message || 'MongoDB query failed'
    });
  }
});
