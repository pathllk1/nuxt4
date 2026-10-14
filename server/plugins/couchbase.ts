import { CouchbaseService } from '../utils/couchbase';

export default defineNitroPlugin(() => {
  console.log('Initializing Couchbase keep-alive via Nitro plugin...');

  // Executes in background when server wakes up (cold start)
  // Non-blocking: will NEVER block incoming user requests or delay the serverless handler
  // Crash-proof: All errors are caught safely and will NEVER crash the server
  Promise.resolve().then(async () => {
    try {
      if (!process.env.COUCHBASE_URL) {
        console.log('⚠️ Couchbase connection skipped: COUCHBASE_URL is not defined in .env');
        return;
      }

      console.log('🔄 [Couchbase] Server instance initialized. Dispatching 30s keep-alive ping...');
      const result = await CouchbaseService.ping(30000);

      if (result.ok) {
        console.log(`✅ [Couchbase] Keep-alive ping succeeded in ${result.elapsedMs}ms`);
      } else {
        console.warn(`⚠️ [Couchbase] Keep-alive ping completed with notice (${result.elapsedMs}ms): ${result.message}`);
      }
    } catch (err: any) {
      // Guaranteed safe catch to prevent any server crash
      console.warn('⚠️ [Couchbase] Health check caught error safely:', err?.message || err);
    }
  });
});
