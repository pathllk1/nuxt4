import { defineEventHandler, readBody, getRouterParam, createError } from 'h3';
import { getScopedCollection } from '../../../utils/firebase';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Wallet ID is required' });
  }

  const body = await readBody(event);
  const col = getScopedCollection(event, 'wallets');
  const updateData: any = { ...body };
  if (updateData.initialBalance !== undefined) {
    updateData.initialBalance = Number(updateData.initialBalance) || 0;
  }

  await col.doc(id.toString()).update(updateData);
  return { success: true, id };
});
