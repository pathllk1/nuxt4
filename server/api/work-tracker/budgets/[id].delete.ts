import { defineEventHandler, getRouterParam, createError } from 'h3';
import { getScopedCollection } from '../../../utils/firebase';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Budget ID is required' });
  }

  const col = getScopedCollection(event, 'budgets');
  await col.doc(id.toString()).delete();

  return { success: true, message: `Budget ${id} deleted` };
});
