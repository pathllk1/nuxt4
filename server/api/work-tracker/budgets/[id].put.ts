import { defineEventHandler, readBody, getRouterParam, createError } from 'h3';
import { getScopedCollection } from '../../../utils/firebase';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Budget ID is required' });
  }

  const body = await readBody(event);
  const col = getScopedCollection(event, 'budgets');
  const updateData: any = { ...body };

  if (updateData.limitAmount !== undefined) {
    updateData.limitAmount = Number(updateData.limitAmount);
  }

  await col.doc(id.toString()).update(updateData);
  return { success: true, id };
});
