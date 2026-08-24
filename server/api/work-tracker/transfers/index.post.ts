import { defineEventHandler, readBody, createError } from 'h3';
import { getScopedCollection } from '../../../utils/firebase';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  if (!body || !body.fromWalletId || !body.toWalletId || body.amount === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Source Vault, Destination Vault, and Amount are required' });
  }

  const id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  const data = {
    ...body,
    id,
    fromWalletId: Number(body.fromWalletId),
    toWalletId: Number(body.toWalletId),
    amount: Number(body.amount),
    createdAt: new Date().toISOString()
  };

  const col = getScopedCollection(event, 'transfers');
  await col.doc(id.toString()).set(data);

  return { success: true, id, data };
});
