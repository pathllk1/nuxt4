import { defineEventHandler, getRouterParam, createError } from 'h3';
import { getScopedCollection, getFirestoreDb } from '../../../utils/firebase';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Work ID is required' });
  }

  const db = getFirestoreDb();
  const batch = db.batch();

  const worksCol = getScopedCollection(event, 'works');
  const paymentsCol = getScopedCollection(event, 'payments');

  batch.delete(worksCol.doc(id.toString()));

  const pSnap = await paymentsCol.where('workId', '==', Number(id)).get();
  for (const pDoc of pSnap.docs) {
    batch.delete(pDoc.ref);
  }

  await batch.commit();
  return { success: true, message: `Work ${id} and linked payments deleted` };
});
