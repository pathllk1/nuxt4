import { defineEventHandler, readBody, createError } from 'h3';
import { getScopedCollection } from '../../../utils/firebase';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  if (!body || !body.name) {
    throw createError({ statusCode: 400, statusMessage: 'Client name is required' });
  }

  const id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  const data = {
    ...body,
    id,
    monthlyRate: body.monthlyRate ? Number(body.monthlyRate) : null,
    createdAt: new Date().toISOString()
  };

  const col = getScopedCollection(event, 'clients');
  await col.doc(id.toString()).set(data);

  return { success: true, id, data };
});
