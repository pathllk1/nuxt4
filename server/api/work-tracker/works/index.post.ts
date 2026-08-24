import { defineEventHandler, readBody, createError } from 'h3';
import { getScopedCollection } from '../../../utils/firebase';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  if (!body || !body.clientId || !body.workType) {
    throw createError({ statusCode: 400, statusMessage: 'Client ID and Work Type are required' });
  }

  const id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  const data = {
    ...body,
    id,
    clientId: Number(body.clientId),
    totalAmount: body.totalAmount === null || body.totalAmount === undefined || body.totalAmount === ''
      ? null
      : Number(body.totalAmount),
    createdAt: new Date().toISOString()
  };

  const col = getScopedCollection(event, 'works');
  await col.doc(id.toString()).set(data);

  return { success: true, id, data };
});
