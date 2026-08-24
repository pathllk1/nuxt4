import { defineEventHandler, getRouterParam, getQuery, createError } from 'h3';
import { getScopedCollection } from '../../../utils/firebase';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Wallet ID is required' });
  }

  const query = getQuery(event);
  const hardDelete = query.hard === 'true';
  const col = getScopedCollection(event, 'wallets');

  if (hardDelete) {
    await col.doc(id.toString()).delete();
  } else {
    await col.doc(id.toString()).update({ isArchived: true });
  }

  return { success: true, message: `Wallet ${id} ${hardDelete ? 'deleted' : 'archived'}` };
});
