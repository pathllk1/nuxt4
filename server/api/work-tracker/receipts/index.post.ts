import { defineEventHandler, readBody, createError } from 'h3';
import { getScopedCollection } from '../../../utils/firebase';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  if (!body || !body.walletId || body.amount === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Wallet ID and Amount are required' });
  }

  const id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  const data = {
    ...body,
    id,
    walletId: Number(body.walletId),
    amount: Number(body.amount),
    createdAt: new Date().toISOString()
  };

  const col = getScopedCollection(event, 'receipts');
  await col.doc(id.toString()).set(data);

  return { success: true, id, data };
});
