import { defineEventHandler, readBody, getRouterParam, createError } from 'h3';
import { getScopedCollection } from '../../../utils/firebase';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Template ID is required' });
  }

  const body = await readBody(event);
  const col = getScopedCollection(event, 'recurring_templates');
  const updateData: any = { ...body };

  if (updateData.fixedAmount !== undefined) updateData.fixedAmount = Number(updateData.fixedAmount);
  if (updateData.clientId !== undefined) updateData.clientId = Number(updateData.clientId);
  if (updateData.isActive !== undefined) updateData.isActive = Boolean(updateData.isActive);

  await col.doc(id.toString()).update(updateData);
  return { success: true, id };
});
