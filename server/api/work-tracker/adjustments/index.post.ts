import { defineEventHandler, readBody, createError } from 'h3';
import { getScopedCollection } from '../../../utils/firebase';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  if (!body || !body.workId || body.amount === undefined || !body.type) {
    throw createError({ statusCode: 400, statusMessage: 'Work ID, Adjustment Type, and Amount are required' });
  }

  const id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  const data = {
    ...body,
    id,
    workId: Number(body.workId),
    amount: Number(body.amount),
    createdAt: new Date().toISOString()
  };

  const col = getScopedCollection(event, 'adjustments');
  await col.doc(id.toString()).set(data);

  return { success: true, id, data };
});
