import { connectPostgres } from '../utils/pg.config';

export default defineNitroPlugin(async (nitroApp) => {
  console.log('Initializing PostgreSQL connection via Nitro plugin...');
  try {
    await connectPostgres();
  } catch (err: any) {
    console.error('PostgreSQL Nitro plugin initialization deferred/failed:', err?.message || err);
  }
});
