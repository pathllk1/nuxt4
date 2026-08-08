import { defineEventHandler, createError } from 'h3';
import { requireSuperAdmin } from '~~/server/utils/admin-guard';
import { getSql } from '~~/server/utils/pg.config';
import mongoose from 'mongoose';
import { connectDB } from '~~/server/utils/db';

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event);
  await connectDB();

  try {
    let postgresTables: string[] = [];
    const sql = getSql();
    if (sql) {
      const tables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name ASC
      `;
      postgresTables = tables.map((t: any) => t.table_name);
    }

    let mongodbCollections: string[] = [];
    if (mongoose.connection.db) {
      const cols = await mongoose.connection.db.listCollections().toArray();
      mongodbCollections = cols.map((c: any) => c.name).sort();
    }

    return {
      success: true,
      postgres: postgresTables,
      mongodb: mongodbCollections
    };
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to fetch database models'
    });
  }
});
