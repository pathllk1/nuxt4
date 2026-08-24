import { defineEventHandler, readBody, getRouterParam, createError } from 'h3';
import { getScopedCollection } from '../../../utils/firebase';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Adjustment ID is required' });
  }

  const body = await readBody(event);
  const col = getScopedCollection(event, 'adjustments');
  const updateData: any = { ...body };

  if (updateData.amount !== undefined) updateData.amount = Number(updateData.amount);
  if (updateData.workId !== undefined) updateData.workId = Number(updateData.workId);

  await col.doc(id.toString()).update(updateData);
  return { success: true, id };
});
