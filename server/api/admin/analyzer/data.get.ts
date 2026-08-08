import { defineEventHandler, createError, getQuery } from 'h3';
import { requireSuperAdmin } from '~~/server/utils/admin-guard';
import { getSql } from '~~/server/utils/pg.config';
import mongoose from 'mongoose';
import { connectDB } from '~~/server/utils/db';

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event);
  await connectDB();

  const queryParams = getQuery(event);
  const type = String(queryParams.type || 'postgres');
  const name = String(queryParams.name || '');

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Model name is required' });
  }

  try {
    let data: any[] = [];

    if (type === 'postgres') {
      if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid table name' });
      }
      const sql = getSql();
      if (!sql) throw createError({ statusCode: 503, statusMessage: 'PostgreSQL connection not ready' });

      data = await sql.unsafe(`SELECT * FROM "${name}" LIMIT 50`);
    } else if (type === 'mongodb') {
      if (!mongoose.connection.db) throw createError({ statusCode: 503, statusMessage: 'MongoDB connection not ready' });

      const collection = mongoose.connection.db.collection(name);
      data = await collection.find({}).limit(50).toArray();
    } else {
      throw createError({ statusCode: 400, statusMessage: `Invalid database type: ${type}` });
    }

    return {
      success: true,
      data
    };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || `Failed to fetch data for ${name}`
    });
  }
});
