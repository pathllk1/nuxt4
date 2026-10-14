import { defineEventHandler } from 'h3';
import { CouchbaseService } from '../../utils/couchbase';

export default defineEventHandler(async () => {
  try {
    const result = await CouchbaseService.ping(30000);
    return {
      status: result.ok ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      ...result
    };
  } catch (err: any) {
    return {
      status: 'error',
      timestamp: new Date().toISOString(),
      ok: false,
      message: err?.message || 'Unexpected health check error',
      elapsedMs: 0
    };
  }
});
