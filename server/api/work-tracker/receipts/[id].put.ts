import { defineEventHandler, readBody, getRouterParam, createError } from 'h3';
import { getScopedCollection } from '../../../utils/firebase';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Receipt ID is required' });
  }

  const body = await readBody(event);
  const col = getScopedCollection(event, 'receipts');
  const updateData: any = { ...body };

  if (updateData.amount !== undefined) updateData.amount = Number(updateData.amount);
  if (updateData.walletId !== undefined) updateData.walletId = Number(updateData.walletId);

  await col.doc(id.toString()).update(updateData);
  return { success: true, id };
});
