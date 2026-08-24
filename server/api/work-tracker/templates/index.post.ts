import { defineEventHandler, readBody, createError } from 'h3';
import { getScopedCollection } from '../../../utils/firebase';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  if (!body || !body.clientId || !body.workType || body.fixedAmount === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Client ID, Work Type, and Fixed Amount are required' });
  }

  const id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  const data = {
    ...body,
    id,
    clientId: Number(body.clientId),
    fixedAmount: Number(body.fixedAmount),
    isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
    createdAt: new Date().toISOString()
  };

  const col = getScopedCollection(event, 'recurring_templates');
  await col.doc(id.toString()).set(data);

  return { success: true, id, data };
});
