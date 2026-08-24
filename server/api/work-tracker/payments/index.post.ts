import { defineEventHandler, readBody, createError } from 'h3';
import { getScopedCollection } from '../../../utils/firebase';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  if (!body || !body.clientId || body.amount === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Client ID and Amount are required' });
  }

  const id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  const data = {
    ...body,
    id,
    workId: body.workId ? Number(body.workId) : null,
    clientId: Number(body.clientId),
    walletId: body.walletId ? Number(body.walletId) : null,
    amount: Number(body.amount),
    createdAt: new Date().toISOString()
  };

  const col = getScopedCollection(event, 'payments');
  await col.doc(id.toString()).set(data);

  return { success: true, id, data };
});
