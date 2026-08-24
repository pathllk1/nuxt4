import { defineEventHandler, readBody, getRouterParam, createError } from 'h3';
import { getScopedCollection } from '../../../utils/firebase';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Payment ID is required' });
  }

  const body = await readBody(event);
  const col = getScopedCollection(event, 'payments');
  const updateData: any = { ...body };

  if (updateData.amount !== undefined) updateData.amount = Number(updateData.amount);
  if (updateData.workId !== undefined) updateData.workId = updateData.workId ? Number(updateData.workId) : null;
  if (updateData.clientId !== undefined) updateData.clientId = Number(updateData.clientId);
  if (updateData.walletId !== undefined) updateData.walletId = updateData.walletId ? Number(updateData.walletId) : null;

  await col.doc(id.toString()).update(updateData);
  return { success: true, id };
});
