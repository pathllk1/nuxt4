import { defineEventHandler, readBody, getRouterParam, createError } from 'h3';
import { getScopedCollection } from '../../../utils/firebase';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Work ID is required' });
  }

  const body = await readBody(event);
  const col = getScopedCollection(event, 'works');
  const updateData: any = { ...body };

  if (updateData.totalAmount !== undefined) {
    updateData.totalAmount = updateData.totalAmount === null || updateData.totalAmount === undefined || updateData.totalAmount === ''
      ? null
      : Number(updateData.totalAmount);
  }
  if (updateData.clientId) {
    updateData.clientId = Number(updateData.clientId);
  }

  await col.doc(id.toString()).update(updateData);
  return { success: true, id };
});
