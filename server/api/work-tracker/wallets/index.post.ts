import { defineEventHandler, readBody, createError } from 'h3';
import { getScopedCollection } from '../../../utils/firebase';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  if (!body || !body.name) {
    throw createError({ statusCode: 400, statusMessage: 'Wallet name is required' });
  }

  const id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  const data = {
    ...body,
    id,
    initialBalance: Number(body.initialBalance) || 0,
    createdAt: new Date().toISOString()
  };

  const col = getScopedCollection(event, 'wallets');
  await col.doc(id.toString()).set(data);

  return { success: true, id, data };
});
