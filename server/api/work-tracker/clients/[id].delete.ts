import { defineEventHandler, getRouterParam, createError } from 'h3';
import { getScopedCollection, getFirestoreDb } from '../../../utils/firebase';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Client ID is required' });
  }

  const db = getFirestoreDb();
  const batch = db.batch();

  const clientsCol = getScopedCollection(event, 'clients');
  const worksCol = getScopedCollection(event, 'works');
  const paymentsCol = getScopedCollection(event, 'payments');

  // Delete client
  batch.delete(clientsCol.doc(id.toString()));

  // Find and delete client's works and payments
  const worksSnap = await worksCol.where('clientId', '==', Number(id)).get();
  for (const wDoc of worksSnap.docs) {
    batch.delete(wDoc.ref);
    const pSnap = await paymentsCol.where('workId', '==', Number(wDoc.id)).get();
    for (const pDoc of pSnap.docs) {
      batch.delete(pDoc.ref);
    }
  }

  // Find direct client payments without work
  const directPaymentsSnap = await paymentsCol.where('clientId', '==', Number(id)).get();
  for (const pDoc of directPaymentsSnap.docs) {
    batch.delete(pDoc.ref);
  }

  await batch.commit();
  return { success: true, message: `Client ${id} and linked records deleted` };
});
