import { connectPostgres } from '../utils/pg.config';

export default defineNitroPlugin(async (nitroApp) => {
  console.log('Initializing PostgreSQL connection via Nitro plugin...');
  await connectPostgres();
});
