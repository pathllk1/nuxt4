import { defineEventHandler, readBody, getRouterParam, createError } from 'h3';
import { getScopedCollection } from '../../../utils/firebase';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Client ID is required' });
  }

  const body = await readBody(event);
  const col = getScopedCollection(event, 'clients');
  const updateData: any = { ...body };
  if (updateData.monthlyRate !== undefined) {
    updateData.monthlyRate = updateData.monthlyRate ? Number(updateData.monthlyRate) : null;
  }

  await col.doc(id.toString()).update(updateData);
  return { success: true, id };
});
