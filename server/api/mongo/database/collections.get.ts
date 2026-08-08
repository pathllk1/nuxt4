import { defineEventHandler, createError } from 'h3';
import { requireSuperAdmin } from '../../../utils/admin-guard';
import mongoose from 'mongoose';
import { connectDB } from '../../../utils/db';

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event);
  await connectDB();

  try {
    if (!mongoose.connection.db) {
      throw createError({ statusCode: 503, statusMessage: 'MongoDB connection not ready' });
    }

    const collections = await mongoose.connection.db.listCollections().toArray();
    return {
      success: true,
      collections: collections.map((c: any) => c.name).sort()
    };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to list MongoDB collections'
    });
  }
});
