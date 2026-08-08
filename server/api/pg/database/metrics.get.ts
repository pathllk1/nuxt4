import { defineEventHandler, createError } from 'h3';
import { requireSuperAdmin } from '~~/server/utils/admin-guard';
import { getSql } from '~~/server/utils/pg.config';
import mongoose from 'mongoose';
import os from 'os';

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event);

  try {
    const sql = getSql();
    let pgStatus = 'disconnected';
    let pgError = null;
    let pgSize = '0 B';

    if (sql) {
      try {
        const [res] = await sql`SELECT 1 as connected`;
        if (res && res.connected === 1) {
          pgStatus = 'connected';
        }
        const [sizeRes] = await sql`SELECT pg_size_pretty(pg_database_size(current_database())) as size`;
        if (sizeRes) pgSize = sizeRes.size;
      } catch (err: any) {
        pgStatus = 'error';
        pgError = err.message;
      }
    }

    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 
                        mongoose.connection.readyState === 2 ? 'connecting' : 
                        mongoose.connection.readyState === 3 ? 'disconnecting' : 'disconnected';
                        
    let mongoSize = '0 B';
    let mongoCollectionsCount = 0;
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      try {
        const stats = await mongoose.connection.db.stats();
        mongoSize = (stats.dataSize / (1024 * 1024)).toFixed(2) + ' MB';
        mongoCollectionsCount = stats.collections;
      } catch {
        // ignore
      }
    }

    const memoryUsage = process.memoryUsage();
    const systemMemory = {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem()
    };

    const metrics = {
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cpuCores: os.cpus().length,
      cpuModel: os.cpus()[0]?.model || 'Unknown',
      memory: {
        process: {
          rss: memoryUsage.rss,
          heapTotal: memoryUsage.heapTotal,
          heapUsed: memoryUsage.heapUsed,
          external: memoryUsage.external
        },
        system: systemMemory
      },
      databases: {
        postgres: {
          status: pgStatus,
          size: pgSize,
          error: pgError
        },
        mongodb: {
          status: mongoStatus,
          size: mongoSize,
          collectionsCount: mongoCollectionsCount
        }
      }
    };

    return { success: true, metrics };
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to fetch system metrics'
    });
  }
});
